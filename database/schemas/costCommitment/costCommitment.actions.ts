import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {issueCostCommitmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/issueCostCommitment.form.validator";
import {closeCostCommitmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/closeCostCommitment.form.validator";
import {cancelCostCommitmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/cancelCostCommitment.form.validator";
import CostCommitment from "./costCommitment";
import {costCommitmentService} from "./costCommitment.service";
import {costCommitmentToDTO} from "@propertyManagement/utilities/mappers/costCommitment/costCommitmentMapper.dto";

export class CostCommitmentActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: issueCostCommitmentFormSchema})
    async issue(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`CostCommitment.issue ` + String(_id) + `...`);
        const existing = await costCommitmentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_issue", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "issued"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await costCommitmentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("costcommitments").readFields!, CostCommitment.schema);
            const updated = await costCommitmentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return costCommitmentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CostCommitment.issue done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: closeCostCommitmentFormSchema})
    async close(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`CostCommitment.close ` + String(_id) + `...`);
        const existing = await costCommitmentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["issued", "partially_received"].includes(status)) {
            throw apiValidationException("invalid_status_for_close", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "closed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await costCommitmentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("costcommitments").readFields!, CostCommitment.schema);
            const updated = await costCommitmentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return costCommitmentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CostCommitment.close done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: cancelCostCommitmentFormSchema})
    async cancel(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`CostCommitment.cancel ` + String(_id) + `...`);
        const existing = await costCommitmentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft", "issued"].includes(status)) {
            throw apiValidationException("invalid_status_for_cancel", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "cancelled"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await costCommitmentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("costcommitments").readFields!, CostCommitment.schema);
            const updated = await costCommitmentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return costCommitmentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CostCommitment.cancel done`);
        return undefined;
    }
}
