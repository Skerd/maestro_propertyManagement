import {Schema} from "mongoose";
import {IProgressClaim} from "./progressClaim";

export function applyProgressClaimIndexes(schema: Schema<IProgressClaim>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
