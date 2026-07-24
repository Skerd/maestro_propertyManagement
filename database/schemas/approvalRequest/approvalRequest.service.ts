import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ApprovalRequest, {IApprovalRequest} from "./approvalRequest";

export class ApprovalRequestService extends BaseCrudService<IApprovalRequest, typeof ApprovalRequest> {
    constructor() {
        super(ApprovalRequest, "ApprovalRequest");
    }
}

export const approvalRequestService = new ApprovalRequestService();
