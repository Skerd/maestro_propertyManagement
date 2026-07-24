/**
 * Bauplattform — token-scoped contractor portal (§3.D).
 *
 * Invited contractors access a tender's Leistungsverzeichnis and submit a priced
 * bid WITHOUT an Arpeggio account, authenticated only by their TenderInvitation
 * portalAccessToken. All reads/writes are scoped by token → invitation → company,
 * so a contractor can only see their own invitation's LV and write their own Bid.
 *
 * Routes (public):
 *   POST /api/realEstate/tenderPortal/invitation   { token }
 *   POST /api/realEstate/tenderPortal/submitBid     { token, total?, coveringNotes?, lines[] }
 */

import * as crypto from "crypto";
import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import TenderInvitation from "../../../database/schemas/tenderInvitation/tenderInvitation";
import Tender from "../../../database/schemas/tender/tender";
import Specification from "../../../database/schemas/specification/specification";
import SpecificationItem from "../../../database/schemas/specificationItem/specificationItem";
import Bid from "../../../database/schemas/bid/bid";
import BidLine from "../../../database/schemas/bidLine/bidLine";

const router = Router();

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

async function resolveInvitation(token: unknown, languageCode: string) {
    if (!token || typeof token !== "string" || token.length < 16) {
        throw apiValidationException("invalid_portal_token", "", null, languageCode);
    }
    const invitation = await TenderInvitation.findOne({portalAccessToken: token, deletedAt: null}).lean();
    if (!invitation) throw apiValidationException("invalid_portal_token", "", null, languageCode);
    if (["withdrawn", "declined"].includes(invitation.status as string)) {
        throw apiValidationException("portal_invitation_closed", "", null, languageCode);
    }
    return invitation;
}

router.post(
    "/invitation",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    asyncHandler(async (params: NotAuthenticatedMWType & {token?: string}) => {
        const {languageCode, token} = params;
        const invitation = await resolveInvitation(token, languageCode);

        // Mark the invitation as viewed the first time the contractor opens it.
        if (invitation.status === "invited") {
            await TenderInvitation.updateOne({_id: invitation._id}, {$set: {status: "viewing"}});
        }

        const tender = await Tender.findOne({_id: invitation.tender, company: invitation.company, deletedAt: null}).lean();
        if (!tender) throw apiValidationException("portal_tender_not_found", "", null, languageCode);

        const specification = tender.specification
            ? await Specification.findOne({_id: tender.specification, company: invitation.company, deletedAt: null}).lean()
            : null;
        const items = specification
            ? await SpecificationItem.find({specification: specification._id, company: invitation.company, status: "active", deletedAt: null})
                .sort({sortIndex: 1}).lean()
            : [];

        // Prefill from an existing (draft) bid for this invitation, if any.
        const existingBid = await Bid.findOne({tender: tender._id, constructorRef: invitation.constructorRef, company: invitation.company, deletedAt: null}).lean();
        const existingLines = existingBid
            ? await BidLine.find({bid: existingBid._id, company: invitation.company, deletedAt: null}).lean()
            : [];
        const priced = new Map(existingLines.map((l: any) => [String(l.specificationItem), l]));

        return {
            invitation: {
                _id: String(invitation._id),
                status: invitation.status,
                invitedAt: invitation.invitedAt ? new Date(invitation.invitedAt).toISOString() : undefined,
            },
            tender: {
                _id: String(tender._id),
                title: tender.title,
                trades: Array.isArray(tender.trades) ? tender.trades : [],
                submissionDeadline: tender.submissionDeadline ? new Date(tender.submissionDeadline).toISOString() : undefined,
                status: tender.status,
            },
            specification: specification ? {_id: String(specification._id), title: specification.title, standard: specification.standard} : null,
            positions: items.map((it: any) => {
                const p = priced.get(String(it._id));
                return {
                    specificationItemId: String(it._id),
                    title: it.title,
                    npkPosition: it.npkPosition,
                    isRPosition: !!it.isRPosition,
                    unitOfMeasure: it.unitOfMeasure,
                    quantity: it.quantity,
                    myUnitPrice: p ? dec(p.unitPrice) : undefined,
                    myLineTotal: p ? dec(p.lineTotal) : undefined,
                };
            }),
            bid: existingBid ? {_id: String(existingBid._id), status: existingBid.status, total: dec(existingBid.total), coveringNotes: existingBid.coveringNotes} : null,
        };
    }),
);

router.post(
    "/submitBid",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 30}),
    asyncHandler(async (params: NotAuthenticatedMWType & {token?: string; total?: number; coveringNotes?: string; lines?: any[]}) => {
        const {languageCode, token, total, coveringNotes, lines} = params;
        const invitation = await resolveInvitation(token, languageCode);

        const tender = await Tender.findOne({_id: invitation.tender, company: invitation.company, deletedAt: null}).lean();
        if (!tender) throw apiValidationException("portal_tender_not_found", "", null, languageCode);
        if (!["published", "closing"].includes(tender.status as string)) {
            throw apiValidationException("portal_tender_not_open", "", null, languageCode);
        }

        // Find or create this contractor's bid (scoped to the invitation's company).
        let bid = await Bid.findOne({tender: tender._id, constructorRef: invitation.constructorRef, company: invitation.company, deletedAt: null});
        if (!bid) {
            bid = new Bid({
                tender: tender._id,
                tenderInvitation: invitation._id,
                constructorRef: invitation.constructorRef,
                currency: tender.currency ?? undefined,
                company: invitation.company,
                createdBy: invitation.createdBy,
            });
        }

        // Price the LV positions the contractor submitted (validating each belongs to this tender's spec).
        const validItemIds = new Set(
            (await SpecificationItem.find({specification: tender.specification, company: invitation.company, deletedAt: null}).select("_id").lean())
                .map((x: any) => String(x._id)),
        );
        let computedTotal = 0;
        const submittedLines = Array.isArray(lines) ? lines : [];
        for (const line of submittedLines) {
            const itemId = String(line?.specificationItemId ?? "");
            if (!validItemIds.has(itemId)) continue;
            const qty = line?.quantity == null ? undefined : Number(line.quantity);
            const unitPrice = line?.unitPrice == null ? undefined : Number(line.unitPrice);
            const lineTotal = qty != null && unitPrice != null && !Number.isNaN(qty) && !Number.isNaN(unitPrice) ? qty * unitPrice : undefined;
            if (lineTotal != null) computedTotal += lineTotal;

            const existingLine = await BidLine.findOne({bid: bid._id, specificationItem: new ObjectId(itemId), company: invitation.company, deletedAt: null});
            if (existingLine) {
                await BidLine.updateOne({_id: existingLine._id}, {$set: {quantity: qty, unitPrice, lineTotal, alternativeNote: line?.alternativeNote}});
            } else {
                await BidLine.create({
                    name: `BIDL-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
                    bid: bid._id,
                    specificationItem: new ObjectId(itemId),
                    quantity: qty,
                    unitPrice,
                    lineTotal,
                    currency: tender.currency ?? undefined,
                    alternativeNote: line?.alternativeNote,
                    company: invitation.company,
                    createdBy: invitation.createdBy,
                });
            }
        }

        bid.set("total", total != null ? total : computedTotal);
        if (coveringNotes !== undefined) bid.set("coveringNotes", coveringNotes);
        bid.set("status", "submitted");
        bid.set("submittedAt", new Date());
        await bid.save();

        await TenderInvitation.updateOne({_id: invitation._id}, {$set: {status: "submitted", respondedAt: new Date()}});

        return {ok: true, bidId: String(bid._id), status: "submitted", total: dec(bid.get("total"))};
    }),
);

export {router};
