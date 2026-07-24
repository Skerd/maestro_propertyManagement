import {Schema} from "mongoose";
import {ICostCommitment} from "./costCommitment";

export function applyCostCommitmentIndexes(schema: Schema<ICostCommitment>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
