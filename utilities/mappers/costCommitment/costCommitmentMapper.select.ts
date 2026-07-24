import type {ICostCommitment} from "../../../database/schemas/costCommitment/costCommitment";

export function costCommitmentsToSelect(docs: ICostCommitment[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
