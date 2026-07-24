import type {IBoqItem} from "../../../database/schemas/boqItem/boqItem";

export function boqItemsToSelect(docs: IBoqItem[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
