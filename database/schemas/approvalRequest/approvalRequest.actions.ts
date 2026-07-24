import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {visaApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/visaApprovalRequest.form.validator";
import {approveApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/approveApprovalRequest.form.validator";
import {rejectApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/rejectApprovalRequest.form.validator";
import {escalateApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/escalateApprovalRequest.form.validator";
import {recallApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/recallApprovalRequest.form.validator";
import ApprovalRequest from "./approvalRequest";
import ApprovalWorkflow from "../approvalWorkflow/approvalWorkflow";
import {approvalRequestService} from "./approvalRequest.service";
import {approvalRequestToDTO} from "@propertyManagement/utilities/mappers/approvalRequest/approvalRequestMapper.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

/** Escalation is required when the amount reaches the workflow threshold and an escalation role is configured. */
async function escalationRequired(request: any, companyId: ObjectId): Promise<boolean> {
    let wf: any = null;
    if (request.workflow) {
        wf = await ApprovalWorkflow.findOne({_id: request.workflow, company: companyId, deletedAt: null}).lean();
    }
    if (!wf) {
        wf = await ApprovalWorkflow.findOne({company: companyId, documentType: request.documentType, active: true, deletedAt: null}).lean();
    }
    if (!wf || !wf.escalationRole) return false;
    const threshold = dec(wf.thresholdAmount);
    const amount = dec(request.amount);
    if (threshold == null) return false;
    return amount != null && amount >= threshold;
}

async function reload(id: any, ctx: any) {
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("approvalrequests").readFields!, ApprovalRequest.schema);
        const updated = await approvalRequestService.findById(id, ctx, populate.populate);
        if (updated) return approvalRequestToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

function withNote(existing: any, notes: any, $set: Record<string, any>): Record<string, any> {
    if (notes !== undefined && notes !== null && String(notes).trim()) {
        const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
        const n = String(notes).trim();
        $set.notes = prev ? (prev + "\n-----\n" + n) : n;
    }
    return $set;
}

export class ApprovalRequestActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: visaApprovalRequestFormSchema})
    async visa(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        const existing = await approvalRequestService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (existing.status !== "pending" || existing.currentStage !== "primary") {
            throw apiValidationException("invalid_state_for_visa", "", null, languageCode);
        }
        const needsEscalation = await escalationRequired(existing, company._id);
        const $set: Record<string, any> = needsEscalation
            ? {primaryDecision: "visaed", currentStage: "escalation"}
            : {primaryDecision: "approved", escalationDecision: "approved", currentStage: "done", status: "approved"};
        await approvalRequestService.updateByIdOrThrow(existing._id, {$set: withNote(existing, notes, $set)}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveApprovalRequestFormSchema})
    async approve(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        const existing = await approvalRequestService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (existing.status !== "pending") {
            throw apiValidationException("invalid_state_for_approve", "", null, languageCode);
        }
        // Escalation approver finalizes; if still at primary with no escalation needed, approve directly.
        const $set: Record<string, any> = existing.currentStage === "escalation"
            ? {escalationDecision: "approved", currentStage: "done", status: "approved"}
            : {primaryDecision: "approved", escalationDecision: "approved", currentStage: "done", status: "approved"};
        await approvalRequestService.updateByIdOrThrow(existing._id, {$set: withNote(existing, notes, $set)}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectApprovalRequestFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        const existing = await approvalRequestService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (existing.status !== "pending") {
            throw apiValidationException("invalid_state_for_reject", "", null, languageCode);
        }
        const stageField = existing.currentStage === "escalation" ? "escalationDecision" : "primaryDecision";
        const $set: Record<string, any> = {[stageField]: "rejected", currentStage: "done", status: "rejected"};
        await approvalRequestService.updateByIdOrThrow(existing._id, {$set: withNote(existing, notes, $set)}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: escalateApprovalRequestFormSchema})
    async escalate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        const existing = await approvalRequestService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (existing.status !== "pending" || existing.currentStage !== "primary") {
            throw apiValidationException("invalid_state_for_escalate", "", null, languageCode);
        }
        await approvalRequestService.updateByIdOrThrow(existing._id, {$set: withNote(existing, notes, {currentStage: "escalation"})}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: recallApprovalRequestFormSchema})
    async recall(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        const existing = await approvalRequestService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (existing.status !== "pending") {
            throw apiValidationException("invalid_state_for_recall", "", null, languageCode);
        }
        await approvalRequestService.updateByIdOrThrow(existing._id, {$set: withNote(existing, notes, {status: "cancelled", currentStage: "done"})}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }
}
