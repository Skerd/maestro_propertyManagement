import type {ITender} from "../../../database/schemas/tender/tender";

export function tendersToSelect(docs: ITender[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
