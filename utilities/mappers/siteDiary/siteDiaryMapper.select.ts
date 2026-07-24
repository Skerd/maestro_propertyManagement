import type {ISiteDiary} from "../../../database/schemas/siteDiary/siteDiary";

export function siteDiarysToSelect(docs: ISiteDiary[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
