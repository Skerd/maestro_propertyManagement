import type {ISpecificationItem} from "../../../database/schemas/specificationItem/specificationItem";

export function specificationItemsToSelect(docs: ISpecificationItem[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
