import type {IBidLine} from "../../../database/schemas/bidLine/bidLine";

export function bidLinesToSelect(docs: IBidLine[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
