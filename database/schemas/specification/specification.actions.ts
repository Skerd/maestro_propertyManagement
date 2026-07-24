import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {issueSpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/issueSpecification.form.validator";
import {markTenderReadySpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/markTenderReadySpecification.form.validator";
import {awardSpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/awardSpecification.form.validator";
import {archiveSpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/archiveSpecification.form.validator";
import {importNpkPositionsSpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/importNpkPositionsSpecification.form.validator";
import Specification from "./specification";
import {specificationService} from "./specification.service";
import {specificationToDTO} from "@propertyManagement/utilities/mappers/specification/specificationMapper.dto";
import {importNpkPositionsIntoSpecification} from "@propertyManagement/utilities/tender/npkImport";

async function transition(
    params: Record<string, any>,
    label: string,
    allowedFrom: string[],
    nextStatus: string,
): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
    logger.start(`Specification.${label} ` + String(_id) + `...`);
    const existing = await specificationService.findOneOrThrow(
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
    await specificationService.updateByIdOrThrow(
        existing._id,
        {$set},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("specifications").readFields!, Specification.schema);
        const updated = await specificationService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return specificationToDTO(updated);
    } catch { /* no read */ }
    logger.finish(`Specification.${label} done`);
    return undefined;
}

export class SpecificationActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: issueSpecificationFormSchema})
    async issue(params: Record<string, any>): Promise<any> {
        return transition(params, "issue", ["draft"], "issued");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markTenderReadySpecificationFormSchema})
    async markTenderReady(params: Record<string, any>): Promise<any> {
        return transition(params, "markTenderReady", ["issued"], "tender_ready");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: awardSpecificationFormSchema})
    async award(params: Record<string, any>): Promise<any> {
        return transition(params, "award", ["tender_ready"], "awarded");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: archiveSpecificationFormSchema})
    async archive(params: Record<string, any>): Promise<any> {
        return transition(params, "archive", ["draft", "issued", "tender_ready", "awarded"], "archived");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 20}, transaction: true, schema: importNpkPositionsSpecificationFormSchema})
    async importNpkPositions(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, codes} = params;
        logger.start(`Specification.importNpkPositions ` + String(_id) + `...`);
        const existing = await specificationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft", "issued"].includes(status)) {
            throw apiValidationException("invalid_status_for_importNpkPositions", "", null, languageCode);
        }
        await importNpkPositionsIntoSpecification({
            specification: existing,
            companyId: company._id,
            codes: Array.isArray(codes) ? codes : undefined,
            session,
            logger,
            auditUserId: actionUserCtx.userId,
        });
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("specifications").readFields!, Specification.schema);
            const updated = await specificationService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return specificationToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Specification.importNpkPositions done`);
        return undefined;
    }
}
