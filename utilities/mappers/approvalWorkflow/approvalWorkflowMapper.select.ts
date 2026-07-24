import type {IApprovalWorkflow} from "../../../database/schemas/approvalWorkflow/approvalWorkflow";

export function approvalWorkflowsToSelect(docs: IApprovalWorkflow[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
