import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {archiveInspectionChecklistTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/archiveInspectionChecklistTemplate.form.validator";
import InspectionChecklistTemplate from "./inspectionChecklistTemplate";
import {inspectionChecklistTemplateService} from "./inspectionChecklistTemplate.service";
import {inspectionChecklistTemplateToDTO} from "@propertyManagement/utilities/mappers/inspectionChecklistTemplate/inspectionChecklistTemplateMapper.dto";

export class InspectionChecklistTemplateActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: archiveInspectionChecklistTemplateFormSchema})
    async archive(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`InspectionChecklistTemplate.archive ` + String(_id) + `...`);
        const existing = await inspectionChecklistTemplateService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "active";
        if (!["active"].includes(status)) {
            throw apiValidationException("invalid_status_for_archive", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "archived"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await inspectionChecklistTemplateService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("inspectionchecklisttemplates").readFields!, InspectionChecklistTemplate.schema);
            const updated = await inspectionChecklistTemplateService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return inspectionChecklistTemplateToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`InspectionChecklistTemplate.archive done`);
        return undefined;
    }
}
