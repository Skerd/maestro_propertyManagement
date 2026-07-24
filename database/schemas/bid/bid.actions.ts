import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/submitBid.form.validator";
import {withdrawBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/withdrawBid.form.validator";
import {shortlistBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/shortlistBid.form.validator";
import {rejectBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/rejectBid.form.validator";
import {awardBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/awardBid.form.validator";
import Bid from "./bid";
import {bidService} from "./bid.service";
import {bidToDTO} from "@propertyManagement/utilities/mappers/bid/bidMapper.dto";

async function move(params: Record<string, any>, label: string, allowedFrom: string[], next: string, extraSet: Record<string, any> = {}): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
    logger.start(`Bid.${label} ` + String(_id) + `...`);
    const existing = await bidService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
    if (!allowedFrom.includes(existing.status ?? "draft")) {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    const $set: Record<string, any> = {status: next, ...extraSet};
    if (notes !== undefined && notes !== null && String(notes).trim()) {
        const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
        const n = String(notes).trim();
        $set.notes = prev ? (prev + "\n-----\n" + n) : n;
    }
    await bidService.updateByIdOrThrow(existing._id, {$set}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("bids").readFields!, Bid.schema);
        const updated = await bidService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return bidToDTO(updated);
    } catch { /* no read */ }
    logger.finish(`Bid.${label} done`);
    return undefined;
}

export class BidActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: submitBidFormSchema})
    async submit(params: Record<string, any>): Promise<any> {
        return move(params, "submit", ["draft"], "submitted", {submittedAt: new Date()});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: withdrawBidFormSchema})
    async withdraw(params: Record<string, any>): Promise<any> {
        return move(params, "withdraw", ["draft", "submitted"], "withdrawn");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: shortlistBidFormSchema})
    async shortlist(params: Record<string, any>): Promise<any> {
        return move(params, "shortlist", ["submitted"], "shortlisted");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectBidFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        return move(params, "reject", ["submitted", "shortlisted"], "rejected");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: awardBidFormSchema})
    async award(params: Record<string, any>): Promise<any> {
        return move(params, "award", ["shortlisted", "submitted"], "awarded");
    }
}
