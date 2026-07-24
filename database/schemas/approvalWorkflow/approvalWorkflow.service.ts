import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ApprovalWorkflow, {IApprovalWorkflow} from "./approvalWorkflow";

export class ApprovalWorkflowService extends BaseCrudService<IApprovalWorkflow, typeof ApprovalWorkflow> {
    constructor() {
        super(ApprovalWorkflow, "ApprovalWorkflow");
    }
}

export const approvalWorkflowService = new ApprovalWorkflowService();
