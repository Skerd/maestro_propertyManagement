import {Schema} from "mongoose";
import {IMaintenanceWorkOrder} from "./maintenanceWorkOrder";
export function applyMaintenanceWorkOrderIndexes(schema: Schema<IMaintenanceWorkOrder>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({plan: 1, status: 1}, {sparse: true});
    schema.index({asset: 1, status: 1}, {sparse: true});
}
