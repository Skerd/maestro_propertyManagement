import type {IMaintenancePlan} from "../../../database/schemas/maintenancePlan/maintenancePlan";
export function maintenancePlansToSelect(docs: IMaintenancePlan[]) { return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name})); }
