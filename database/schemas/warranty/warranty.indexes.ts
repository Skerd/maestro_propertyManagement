import {Schema} from "mongoose";
import {IWarranty} from "./warranty";

export function applyWarrantyIndexes(schema: Schema<IWarranty>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
