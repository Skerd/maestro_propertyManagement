import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {publishTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/publishTender.form.validator";
import {closeSubmissionsTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/closeSubmissionsTender.form.validator";
import {awardTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/awardTender.form.validator";
import {cancelTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/cancelTender.form.validator";
import {reissueTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/reissueTender.form.validator";
import Tender from "./tender";
import {tenderService} from "./tender.service";
import {tenderToDTO} from "@propertyManagement/utilities/mappers/tender/tenderMapper.dto";

async function transition(
    params: Record<string, any>,
    label: string,
    allowedFrom: string[],
    nextStatus: string,
): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
    logger.start(`Tender.${label} ` + String(_id) + `...`);
    const existing = await tenderService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
    const status = existing.status ?? "draft";
    if (!allowedFrom.includes(status)) {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    const $set: Record<string, any> = {status: nextStatus};
    if (notes !== undefined && notes !== null && String(notes).trim()) {
        const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
        const next = String(notes).trim();
        $set.notes = prev ? (prev + "\n-----\n" + next) : next;
    }
    await tenderService.updateByIdOrThrow(
        existing._id,
        {$set},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("tenders").readFields!, Tender.schema);
        const updated = await tenderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return tenderToDTO(updated);
    } catch { /* no read */ }
    logger.finish(`Tender.${label} done`);
    return undefined;
}

export class TenderActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: publishTenderFormSchema})
    async publish(params: Record<string, any>): Promise<any> {
        return transition(params, "publish", ["draft"], "published");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: closeSubmissionsTenderFormSchema})
    async closeSubmissions(params: Record<string, any>): Promise<any> {
        return transition(params, "closeSubmissions", ["published", "closing"], "closed");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: awardTenderFormSchema})
    async award(params: Record<string, any>): Promise<any> {
        return transition(params, "award", ["closed"], "awarded");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: cancelTenderFormSchema})
    async cancel(params: Record<string, any>): Promise<any> {
        return transition(params, "cancel", ["draft", "published", "closing", "closed"], "cancelled");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: reissueTenderFormSchema})
    async reissue(params: Record<string, any>): Promise<any> {
        return transition(params, "reissue", ["cancelled", "closed"], "draft");
    }
}
