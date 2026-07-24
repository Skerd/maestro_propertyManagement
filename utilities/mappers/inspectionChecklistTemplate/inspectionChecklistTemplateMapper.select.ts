import type {IInspectionChecklistTemplate} from "../../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";

export function inspectionChecklistTemplatesToSelect(docs: IInspectionChecklistTemplate[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
