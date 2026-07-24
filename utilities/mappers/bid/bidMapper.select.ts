import type {IBid} from "../../../database/schemas/bid/bid";

export function bidsToSelect(docs: IBid[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.name,
    }));
}
