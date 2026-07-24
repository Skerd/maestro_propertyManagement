import type {IApprovalRequest} from "../../../database/schemas/approvalRequest/approvalRequest";

export function approvalRequestsToSelect(docs: IApprovalRequest[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.name,
    }));
}
