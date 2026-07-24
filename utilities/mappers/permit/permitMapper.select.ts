import type {IPermit} from "../../../database/schemas/permit/permit";

export function permitsToSelect(docs: IPermit[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
