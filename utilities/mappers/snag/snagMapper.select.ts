import type {ISnag} from "../../../database/schemas/snag/snag";

export function snagsToSelect(docs: ISnag[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
