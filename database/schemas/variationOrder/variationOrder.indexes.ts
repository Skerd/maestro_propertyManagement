import {Schema} from "mongoose";
import {IVariationOrder} from "./variationOrder";

export function applyVariationOrderIndexes(schema: Schema<IVariationOrder>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
