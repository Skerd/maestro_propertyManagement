import {Schema} from "mongoose";
import {IBimQuantity} from "./bimQuantity";
export function applyBimQuantityIndexes(schema: Schema<IBimQuantity>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({bimModel: 1});
    schema.index({classificationCode: 1}, {sparse: true});
}
