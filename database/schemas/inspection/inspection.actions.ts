import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {SingleForm} from "armonia/src/modules/core/types/shared.types";
import {cancelScheduledInspectionFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/cancelScheduledInspection.form.validator";
import {updateInspectionChecklistItemsFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/updateInspectionChecklistItems.form.validator";
import type {Inspection as InspectionData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.dto";
import {inspectionToDTO} from "@propertyManagement/utilities/mappers/inspection/inspectionMapper.dto";
import {
    applyInspectionItemPatches,
    inspectionsWithChecklistContext,
    isInspectionChecklistLocked,
    syncInspectionChecklist,
    toChecklistRows,
} from "@propertyManagement/utilities/inspectionChecklist/inspectionChecklist";
import {unitService} from "../unit/unit.service";
import Inspection, {InspectionStatus} from "./inspection";
import {inspectionService} from "./inspection.service";

export class InspectionActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: cancelScheduledInspectionFormSchema,
    })
    async cancelScheduled(params: Record<string, any>): Promise<InspectionData | undefined> {
        const {logger, languageCode, session, _id, cancellationReason, actionUserCtx, company} = params;

        logger.start(`Cancelling scheduled inspection: ${_id}...`);

        const existing = await inspectionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        const unitRefId = (existing.unit as any)?._id ?? existing.unit;
        await unitService.findOneOrThrow(
            {_id: new ObjectId(unitRefId.toString()), company: company._id},
            {session, logger, languageCode, withDeleted: false},
        );

        if (existing.status !== InspectionStatus.SCHEDULED) {
            throw apiValidationException("invalid_status_for_cancel_scheduled", "", null, languageCode);
        }

        await inspectionService.updateByIdOrThrow(
            existing._id,
            {$set: {status: InspectionStatus.CANCELLED, cancellationReason: cancellationReason ?? "", cancelledAt: new Date()}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        let returnData: InspectionData | undefined;
        try {
            const readFields = SchemaGuard.sanitizeFields(
                Inspection,
                getModelCollectedData("inspections").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readFields, Inspection.schema);
            const updated = await inspectionService.findById(existing._id, {session, logger, languageCode}, populate.populate, populate.select);
            returnData = inspectionToDTO(updated);
        } catch {
            logger.debug("User has no read permission on inspection!");
        }

        logger.finish(`Successfully cancelled scheduled inspection: ${_id}`);
        return returnData;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: updateInspectionChecklistItemsFormSchema,
    })
    async updateChecklistItems(params: Record<string, any>): Promise<InspectionData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, items} = params;
        logger.start(`Inspection.updateChecklistItems ${_id}...`);

        const existing = await inspectionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        if (isInspectionChecklistLocked(existing.status)) {
            throw apiValidationException("invalid_status_for_update_inspection_checklist", "", null, languageCode);
        }

        const synced = await syncInspectionChecklist(existing, company._id, {session, logger, languageCode});
        const nextItems = applyInspectionItemPatches(
            toChecklistRows(synced.inspection.checklistItems),
            items,
            actionUserCtx.userId,
        );
        await inspectionService.updateByIdOrThrow(
            existing._id,
            {$set: {checklistItems: nextItems}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        const updated = await inspectionService.findById(existing._id, {session, logger, languageCode});
        if (!updated) return inspectionToDTO(existing);
        const [dto] = await inspectionsWithChecklistContext([updated], {company, session, logger, languageCode});
        logger.finish(`Inspection.updateChecklistItems done`);
        return dto;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async start(params: Record<string, any>): Promise<InspectionData | undefined> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params as Record<string, any> & SingleForm;
        logger.start(`Starting inspection: ${_id}...`);

        const existing = await inspectionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        if (existing.status !== InspectionStatus.SCHEDULED && existing.status !== InspectionStatus.RESCHEDULED) {
            throw apiValidationException("invalid_status_for_start_inspection", "", null, languageCode);
        }

        await inspectionService.updateByIdOrThrow(
            existing._id,
            {$set: {status: InspectionStatus.IN_PROGRESS}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        logger.finish(`Started inspection: ${_id}`);
        return this.reloadWithChecklist(existing._id, params);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async complete(params: Record<string, any>): Promise<InspectionData | undefined> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params as Record<string, any> & SingleForm;
        logger.start(`Completing inspection: ${_id}...`);

        const existing = await inspectionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        if (existing.status !== InspectionStatus.IN_PROGRESS) {
            throw apiValidationException("invalid_status_for_complete_inspection", "", null, languageCode);
        }
        // The template may have gained items since the inspection started: gate on the synced list.
        const {complete: checklistComplete} = await syncInspectionChecklist(existing, company._id, {session, logger, languageCode});
        if (!checklistComplete) {
            throw apiValidationException("inspection_checklist_incomplete", "", null, languageCode);
        }

        await inspectionService.updateByIdOrThrow(
            existing._id,
            {$set: {status: InspectionStatus.COMPLETED, completedAt: new Date()}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        logger.finish(`Completed inspection: ${_id}`);
        return this.reloadWithChecklist(existing._id, params);
    }

    /** The inspection as the sheet shows it, or undefined when the caller may not read it back. */
    private async reloadWithChecklist(inspectionId: ObjectId, params: Record<string, any>): Promise<InspectionData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company} = params;
        try {
            const readFields = SchemaGuard.sanitizeFields(
                Inspection,
                getModelCollectedData("inspections").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readFields, Inspection.schema);
            const updated = await inspectionService.findById(inspectionId, {session, logger, languageCode}, populate.populate, populate.select);
            if (!updated) return undefined;
            const [dto] = await inspectionsWithChecklistContext([updated], {company, session, logger, languageCode});
            return dto;
        } catch {
            logger.debug("User has no read permission on inspection!");
            return undefined;
        }
    }
}
