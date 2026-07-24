import type {ICostClassification} from "../../../database/schemas/costClassification/costClassification";

export function costClassificationsToSelect(docs: ICostClassification[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: `${doc.code} — ${doc.title}`,
    }));
}
