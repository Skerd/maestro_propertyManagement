import type {IWarranty} from "../../../database/schemas/warranty/warranty";

export function warrantysToSelect(docs: IWarranty[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
