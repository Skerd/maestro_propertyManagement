import {Schema} from "mongoose";
import {IBimModel} from "./bimModel";
export function applyBimModelIndexes(schema: Schema<IBimModel>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({project: 1}, {sparse: true});
    schema.index({importStatus: 1});
}
