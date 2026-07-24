import {Schema} from "mongoose";
import {IMaintenancePlan} from "./maintenancePlan";
export function applyMaintenancePlanIndexes(schema: Schema<IMaintenancePlan>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({asset: 1}, {sparse: true});
    schema.index({active: 1, nextDueAt: 1});
}
