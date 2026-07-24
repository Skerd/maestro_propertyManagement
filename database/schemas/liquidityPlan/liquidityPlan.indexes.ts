import {Schema} from "mongoose";
import {ILiquidityPlan} from "./liquidityPlan";

export function applyLiquidityPlanIndexes(schema: Schema<ILiquidityPlan>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({project: 1}, {sparse: true});
}
