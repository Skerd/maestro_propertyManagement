import {Schema} from "mongoose";
import {ITender} from "./tender";

export function applyTenderIndexes(schema: Schema<ITender>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
    schema.index({submissionDeadline: 1}, {sparse: true});
}
