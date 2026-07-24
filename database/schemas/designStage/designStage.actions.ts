import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {startDesignStageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/startDesignStage.form.validator";
import {completeDesignStageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/completeDesignStage.form.validator";
import {blockDesignStageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/blockDesignStage.form.validator";
import DesignStage from "./designStage";
import {designStageService} from "./designStage.service";
import {designStageToDTO} from "@propertyManagement/utilities/mappers/designStage/designStageMapper.dto";
import {projectDocumentService} from "../projectDocument/projectDocument.service";

export class DesignStageActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: startDesignStageFormSchema})
    async start(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`DesignStage.start ` + String(_id) + `...`);
        const existing = await designStageService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "not_started";
        if (!["not_started", "blocked"].includes(status)) {
            throw apiValidationException("invalid_status_for_start", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "in_progress"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await designStageService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("designstages").readFields!, DesignStage.schema);
            const updated = await designStageService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return designStageToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`DesignStage.start done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: completeDesignStageFormSchema})
    async complete(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`DesignStage.complete ` + String(_id) + `...`);
        const existing = await designStageService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "not_started";
        if (!["in_progress"].includes(status)) {
            throw apiValidationException("invalid_status_for_complete", "", null, languageCode);
        }

        // Deliverable gate: a stage with required deliverables cannot complete
        // until each of them is approved (or as-built / superseded by a newer rev).
        const pendingDeliverable = await projectDocumentService.findOne(
            {
                designStage: existing._id,
                company: company._id,
                isRequiredDeliverable: true,
                status: {$nin: ["approved", "superseded"]},
                deletedAt: null,
            },
            {session, logger, languageCode},
        );
        if (pendingDeliverable) {
            throw apiValidationException("design_stage_requires_approved_deliverables", "", null, languageCode);
        }

        const $set: Record<string, any> = {status: "completed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await designStageService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("designstages").readFields!, DesignStage.schema);
            const updated = await designStageService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return designStageToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`DesignStage.complete done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: blockDesignStageFormSchema})
    async block(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`DesignStage.block ` + String(_id) + `...`);
        const existing = await designStageService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "not_started";
        if (!["not_started", "in_progress"].includes(status)) {
            throw apiValidationException("invalid_status_for_block", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "blocked"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await designStageService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("designstages").readFields!, DesignStage.schema);
            const updated = await designStageService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return designStageToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`DesignStage.block done`);
        return undefined;
    }
}
