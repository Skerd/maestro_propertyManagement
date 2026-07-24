import {Schema} from "mongoose";
import {IApprovalRequest} from "./approvalRequest";

export function applyApprovalRequestIndexes(schema: Schema<IApprovalRequest>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({company: 1, status: 1});
    schema.index({targetType: 1, targetId: 1});
    schema.index({documentType: 1, status: 1});
}
