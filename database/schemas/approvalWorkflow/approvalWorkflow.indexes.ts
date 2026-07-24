import {Schema} from "mongoose";
import {IApprovalWorkflow} from "./approvalWorkflow";

export function applyApprovalWorkflowIndexes(schema: Schema<IApprovalWorkflow>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({company: 1, documentType: 1, active: 1});
}
