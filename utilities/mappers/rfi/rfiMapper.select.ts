import type {IRfi} from "../../../database/schemas/rfi/rfi";

export function rfisToSelect(docs: IRfi[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
