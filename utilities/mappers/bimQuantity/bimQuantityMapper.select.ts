import type {IBimQuantity} from "../../../database/schemas/bimQuantity/bimQuantity";
export function bimQuantitiesToSelect(docs: IBimQuantity[]) { return docs.map((doc) => ({value: doc._id.toString(), label: doc.name})); }
