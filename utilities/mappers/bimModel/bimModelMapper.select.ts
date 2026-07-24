import type {IBimModel} from "../../../database/schemas/bimModel/bimModel";
export function bimModelsToSelect(docs: IBimModel[]) { return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name})); }
