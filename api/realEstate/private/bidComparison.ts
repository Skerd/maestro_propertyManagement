/**
 * bidComparison — Angebotsvergleich read-model (§3.E).
 *
 * POST /api/realEstate/bidComparison { tenderId } ranks the tender's bids by a
 * weighted score: price (lowest total best), contractor quality (performanceScore)
 * and completeness (share of LV positions the bid priced). Returns a recommendation.
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Tender from "../../../database/schemas/tender/tender";
import Bid from "../../../database/schemas/bid/bid";
import BidLine from "../../../database/schemas/bidLine/bidLine";
import SpecificationItem from "../../../database/schemas/specificationItem/specificationItem";
import Constructor from "../../../database/schemas/constructor/constructor";
import type {BidComparisonResponse, BidComparisonRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/bidComparison/bidComparison.response.type";

export const basePath = "/api/realEstate/bidComparison";
export const router = Router();

const WEIGHTS = {price: 0.5, quality: 0.3, completeness: 0.2};

function num(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType & {tenderId?: string}): Promise<BidComparisonResponse> => {
        const {company, languageCode, tenderId} = params;
        if (!tenderId || !ObjectId.isValid(tenderId)) {
            throw apiValidationException("tenderId_required", "", null, languageCode);
        }
        const companyId = company._id as ObjectId;
        const tender = await Tender.findOne({_id: new ObjectId(tenderId), company: companyId, deletedAt: null}).lean();
        if (!tender) throw apiValidationException("tender_not_found", "", null, languageCode);

        const specItemCount = tender.specification
            ? await SpecificationItem.countDocuments({specification: tender.specification, company: companyId, status: "active", deletedAt: null})
            : 0;

        const bids = await Bid.find({tender: tender._id, company: companyId, deletedAt: null, status: {$nin: ["withdrawn"]}})
            .populate({path: "constructorRef", select: "name performanceScore"})
            .populate({path: "currency", select: "abbreviation"})
            .lean();

        // Priced-line counts per bid.
        const lineCounts = await BidLine.aggregate([
            {$match: {bid: {$in: bids.map((b: any) => b._id)}, company: companyId, deletedAt: null}},
            {$group: {_id: "$bid", n: {$sum: 1}}},
        ]);
        const linesByBid = new Map(lineCounts.map((l: any) => [String(l._id), l.n as number]));

        const totals = bids.map((b: any) => num(b.total)).filter((x): x is number => x != null && x > 0);
        const minTotal = totals.length ? Math.min(...totals) : 0;

        const rows: BidComparisonRow[] = bids.map((b: any) => {
            const total = num(b.total);
            const priceScore = total && minTotal ? Math.max(0, Math.min(100, (minTotal / total) * 100)) : (total === undefined ? 0 : 100);
            const performance = num(b.constructorRef?.performanceScore);
            const qualityScore = performance != null ? Math.max(0, Math.min(100, performance)) : 50;
            const linesPriced = linesByBid.get(String(b._id)) ?? 0;
            const completenessScore = specItemCount > 0 ? Math.max(0, Math.min(100, (linesPriced / specItemCount) * 100)) : (linesPriced > 0 ? 100 : 0);
            const overallScore = priceScore * WEIGHTS.price + qualityScore * WEIGHTS.quality + completenessScore * WEIGHTS.completeness;
            return {
                bidId: String(b._id),
                bidName: b.name,
                constructorId: b.constructorRef?._id ? String(b.constructorRef._id) : undefined,
                constructorName: b.constructorRef?.name,
                status: b.status,
                total,
                currencyAbbr: b.currency?.abbreviation,
                linesPriced,
                linesTotal: specItemCount,
                priceScore: Math.round(priceScore * 10) / 10,
                qualityScore: Math.round(qualityScore * 10) / 10,
                completenessScore: Math.round(completenessScore * 10) / 10,
                overallScore: Math.round(overallScore * 10) / 10,
                recommended: false,
            };
        });

        rows.sort((a, b) => b.overallScore - a.overallScore);
        // Recommend the best-scoring bid that hasn't been rejected.
        const recommended = rows.find(r => r.status !== "rejected");
        if (recommended) recommended.recommended = true;

        return {
            tenderId: String(tender._id),
            tenderTitle: tender.title,
            specificationItemCount: specItemCount,
            weights: WEIGHTS,
            rows,
            recommendedBidId: recommended?.bidId,
            computedAt: new Date().toISOString(),
        };
    }),
);
