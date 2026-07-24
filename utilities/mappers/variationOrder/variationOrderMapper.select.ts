import type {IVariationOrder} from "../../../database/schemas/variationOrder/variationOrder";

export function variationOrdersToSelect(docs: IVariationOrder[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
