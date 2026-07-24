import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {approveArchitectVariationOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/approveArchitectVariationOrder.form.validator";
import {approveQsVariationOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/approveQsVariationOrder.form.validator";
import {approveClientVariationOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/approveClientVariationOrder.form.validator";
import {rejectVariationOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/rejectVariationOrder.form.validator";
import {cancelVariationOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/cancelVariationOrder.form.validator";
import {billVariationsVariationOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/billVariationsVariationOrder.form.validator";
import VariationOrder from "./variationOrder";
import {variationOrderService} from "./variationOrder.service";
import {variationOrderToDTO} from "@propertyManagement/utilities/mappers/variationOrder/variationOrderMapper.dto";
import {recomputeContractCostTruth} from "@propertyManagement/utilities/cost/contractCostTruth";

export class VariationOrderActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveArchitectVariationOrderFormSchema})
    async approveArchitect(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`VariationOrder.approveArchitect ` + String(_id) + `...`);
        const existing = await variationOrderService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending_architect";
        if (!["pending_architect"].includes(status)) {
            throw apiValidationException("invalid_status_for_approveArchitect", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "pending_qs"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await variationOrderService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("variationorders").readFields!, VariationOrder.schema);
            const updated = await variationOrderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return variationOrderToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`VariationOrder.approveArchitect done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveQsVariationOrderFormSchema})
    async approveQs(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`VariationOrder.approveQs ` + String(_id) + `...`);
        const existing = await variationOrderService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending_architect";
        if (!["pending_qs"].includes(status)) {
            throw apiValidationException("invalid_status_for_approveQs", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "pending_client"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await variationOrderService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("variationorders").readFields!, VariationOrder.schema);
            const updated = await variationOrderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return variationOrderToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`VariationOrder.approveQs done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveClientVariationOrderFormSchema})
    async approveClient(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`VariationOrder.approveClient ` + String(_id) + `...`);
        const existing = await variationOrderService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending_architect";
        if (!["pending_client"].includes(status)) {
            throw apiValidationException("invalid_status_for_approveClient", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "approved"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await variationOrderService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        if (existing.constructionContract) {
            const contractId = new ObjectId((existing.constructionContract?._id ?? existing.constructionContract).toString());
            await recomputeContractCostTruth(contractId, {session, logger, languageCode, actionUserCtx, company});
        }
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("variationorders").readFields!, VariationOrder.schema);
            const updated = await variationOrderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return variationOrderToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`VariationOrder.approveClient done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectVariationOrderFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`VariationOrder.reject ` + String(_id) + `...`);
        const existing = await variationOrderService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending_architect";
        if (!["pending_architect", "pending_qs", "pending_client"].includes(status)) {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "rejected"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await variationOrderService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("variationorders").readFields!, VariationOrder.schema);
            const updated = await variationOrderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return variationOrderToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`VariationOrder.reject done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: cancelVariationOrderFormSchema})
    async cancel(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`VariationOrder.cancel ` + String(_id) + `...`);
        const existing = await variationOrderService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending_architect";
        if (!["pending_architect", "pending_qs", "pending_client"].includes(status)) {
            throw apiValidationException("invalid_status_for_cancel", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "cancelled"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await variationOrderService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("variationorders").readFields!, VariationOrder.schema);
            const updated = await variationOrderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return variationOrderToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`VariationOrder.cancel done`);
        return undefined;
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 20}, transaction: true, schema: billVariationsVariationOrderFormSchema})
    async billVariations(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, variationOrderIds, billingReference} = params;
        logger.start(`VariationOrder.billVariations ` + String((variationOrderIds || []).length) + ` VOs...`);
        const ids: ObjectId[] = (variationOrderIds as string[]).map((id) => new ObjectId(id));
        const ref = billingReference && String(billingReference).trim()
            ? String(billingReference).trim()
            : `NB-${Date.now().toString(36).toUpperCase()}`;

        // Only approved, not-yet-billed VOs can be billed (single or grouped).
        const vos = await variationOrderService.find(
            {_id: {$in: ids}, company: company._id, status: "approved", billedAt: {$in: [null, undefined]}, deletedAt: null},
            {session, logger, languageCode},
        );
        if (!vos.length) {
            throw apiValidationException("no_billable_variations", "", null, languageCode);
        }
        const billedAt = new Date();
        for (const vo of vos) {
            await variationOrderService.updateByIdOrThrow(
                vo._id,
                {$set: {billedAt, billingReference: ref}},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }
        logger.finish(`VariationOrder.billVariations done — billed ${vos.length} under ${ref}`);
        return {billed: vos.length, billingReference: ref};
    }
}
