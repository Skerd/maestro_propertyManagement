import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {startProgressPlanMarkupFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/startProgressPlanMarkup.form.validator";
import {resolvePlanMarkupFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/resolvePlanMarkup.form.validator";
import {reopenPlanMarkupFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/reopenPlanMarkup.form.validator";
import {voidMarkupPlanMarkupFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/voidMarkupPlanMarkup.form.validator";
import PlanMarkup from "./planMarkup";
import {planMarkupService} from "./planMarkup.service";
import {planMarkupToDTO} from "@propertyManagement/utilities/mappers/planMarkup/planMarkupMapper.dto";

async function transition(params: Record<string, any>, label: string, from: string[], next: string): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
    logger.start(`PlanMarkup.${label} ` + String(_id) + `...`);
    const existing = await planMarkupService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
    if (!from.includes(existing.status ?? "open")) {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    const $set: Record<string, any> = {status: next};
    if (notes !== undefined && notes !== null && String(notes).trim()) {
        const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
        const n = String(notes).trim();
        $set.notes = prev ? (prev + "\n-----\n" + n) : n;
    }
    await planMarkupService.updateByIdOrThrow(existing._id, {$set}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("planmarkups").readFields!, PlanMarkup.schema);
        const updated = await planMarkupService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return planMarkupToDTO(updated);
    } catch { /* no read */ }
    logger.finish(`PlanMarkup.${label} done`);
    return undefined;
}

export class PlanMarkupActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: startProgressPlanMarkupFormSchema})
    async startProgress(params: Record<string, any>): Promise<any> {
        return transition(params, "startProgress", ["open"], "in_progress");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: resolvePlanMarkupFormSchema})
    async resolve(params: Record<string, any>): Promise<any> {
        return transition(params, "resolve", ["open", "in_progress"], "done");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: reopenPlanMarkupFormSchema})
    async reopen(params: Record<string, any>): Promise<any> {
        return transition(params, "reopen", ["done", "void"], "open");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: voidMarkupPlanMarkupFormSchema})
    async voidMarkup(params: Record<string, any>): Promise<any> {
        return transition(params, "voidMarkup", ["open", "in_progress"], "void");
    }
}
