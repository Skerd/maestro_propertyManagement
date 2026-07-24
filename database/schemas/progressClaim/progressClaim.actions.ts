import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitProgressClaimFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/progressClaim/submitProgressClaim.form.validator";
import {certifyProgressClaimFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/progressClaim/certifyProgressClaim.form.validator";
import {markPaidProgressClaimFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/progressClaim/markPaidProgressClaim.form.validator";
import {rejectProgressClaimFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/progressClaim/rejectProgressClaim.form.validator";
import ProgressClaim from "./progressClaim";
import {progressClaimService} from "./progressClaim.service";
import {progressClaimToDTO} from "@propertyManagement/utilities/mappers/progressClaim/progressClaimMapper.dto";
import {constructionContractService} from "../constructionContract/constructionContract.service";
import {
    recomputeContractCostTruth,
    sumApprovedVariationCostImpact,
    sumCertifiedClaims,
} from "@propertyManagement/utilities/cost/contractCostTruth";
import Decimal from "decimal.js";

export class ProgressClaimActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: submitProgressClaimFormSchema})
    async submit(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ProgressClaim.submit ` + String(_id) + `...`);
        const existing = await progressClaimService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_submit", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "submitted"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await progressClaimService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("progressclaims").readFields!, ProgressClaim.schema);
            const updated = await progressClaimService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return progressClaimToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ProgressClaim.submit done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: certifyProgressClaimFormSchema})
    async certify(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ProgressClaim.certify ` + String(_id) + `...`);
        const existing = await progressClaimService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["submitted"].includes(status)) {
            throw apiValidationException("invalid_status_for_certify", "", null, languageCode);
        }

        // Cost-truth guard: certified value across the contract may not exceed
        // contractValue + approved variation orders. Overage requires a VO first.
        const contractId = new ObjectId((existing.constructionContract?._id ?? existing.constructionContract).toString());
        const contract = await constructionContractService.findOneOrThrow(
            {_id: contractId, company: company._id},
            {session, logger, languageCode},
        );
        const costCtx = {session, logger, languageCode, actionUserCtx, company};
        const cap = new Decimal(String(contract.contractValue ?? 0))
            .plus(await sumApprovedVariationCostImpact(contractId, costCtx));
        const alreadyCertified = await sumCertifiedClaims(contractId, costCtx, existing._id);
        const thisClaim = new Decimal(String(existing.certifiedAmount ?? existing.amount ?? 0));
        if (alreadyCertified.plus(thisClaim).greaterThan(cap)) {
            throw apiValidationException("progress_claim_exceeds_contract_value_approve_variation_order_first", "", null, languageCode);
        }

        const $set: Record<string, any> = {status: "certified"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await progressClaimService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        await recomputeContractCostTruth(contractId, costCtx);
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("progressclaims").readFields!, ProgressClaim.schema);
            const updated = await progressClaimService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return progressClaimToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ProgressClaim.certify done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markPaidProgressClaimFormSchema})
    async markPaid(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ProgressClaim.markPaid ` + String(_id) + `...`);
        const existing = await progressClaimService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["certified"].includes(status)) {
            throw apiValidationException("invalid_status_for_markPaid", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "paid"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await progressClaimService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("progressclaims").readFields!, ProgressClaim.schema);
            const updated = await progressClaimService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return progressClaimToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ProgressClaim.markPaid done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectProgressClaimFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ProgressClaim.reject ` + String(_id) + `...`);
        const existing = await progressClaimService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["submitted"].includes(status)) {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "rejected"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await progressClaimService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("progressclaims").readFields!, ProgressClaim.schema);
            const updated = await progressClaimService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return progressClaimToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ProgressClaim.reject done`);
        return undefined;
    }
}
