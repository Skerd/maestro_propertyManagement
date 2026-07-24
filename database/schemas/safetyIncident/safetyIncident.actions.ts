import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {startInvestigationSafetyIncidentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/startInvestigationSafetyIncident.form.validator";
import {closeSafetyIncidentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/closeSafetyIncident.form.validator";
import SafetyIncident from "./safetyIncident";
import {safetyIncidentService} from "./safetyIncident.service";
import {safetyIncidentToDTO} from "@propertyManagement/utilities/mappers/safetyIncident/safetyIncidentMapper.dto";

export class SafetyIncidentActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: startInvestigationSafetyIncidentFormSchema})
    async startInvestigation(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`SafetyIncident.startInvestigation ` + String(_id) + `...`);
        const existing = await safetyIncidentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "reported";
        if (!["reported"].includes(status)) {
            throw apiValidationException("invalid_status_for_startInvestigation", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "investigating"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await safetyIncidentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("safetyincidents").readFields!, SafetyIncident.schema);
            const updated = await safetyIncidentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return safetyIncidentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`SafetyIncident.startInvestigation done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: closeSafetyIncidentFormSchema})
    async close(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`SafetyIncident.close ` + String(_id) + `...`);
        const existing = await safetyIncidentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "reported";
        if (!["reported", "investigating"].includes(status)) {
            throw apiValidationException("invalid_status_for_close", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "closed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await safetyIncidentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("safetyincidents").readFields!, SafetyIncident.schema);
            const updated = await safetyIncidentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return safetyIncidentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`SafetyIncident.close done`);
        return undefined;
    }
}
