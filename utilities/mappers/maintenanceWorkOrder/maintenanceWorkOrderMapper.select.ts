import type {IMaintenanceWorkOrder} from "../../../database/schemas/maintenanceWorkOrder/maintenanceWorkOrder";
export function maintenanceWorkOrdersToSelect(docs: IMaintenanceWorkOrder[]) { return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name})); }
