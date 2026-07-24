import {Schema} from "mongoose";
import {ICommissioningRecord} from "./commissioningRecord";

export function applyCommissioningRecordIndexes(schema: Schema<ICommissioningRecord>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
