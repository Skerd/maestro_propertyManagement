import {Schema} from "mongoose";
import {ILiquidityLine} from "./liquidityLine";

export function applyLiquidityLineIndexes(schema: Schema<ILiquidityLine>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({plan: 1, period: 1});
    schema.index({plan: 1, direction: 1});
}
