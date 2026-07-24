import type {ISubmittal} from "../../../database/schemas/submittal/submittal";

export function submittalsToSelect(docs: ISubmittal[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
