import type {IFeasibilityStudy} from "../../../database/schemas/feasibilityStudy/feasibilityStudy";

export function feasibilityStudysToSelect(docs: IFeasibilityStudy[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
