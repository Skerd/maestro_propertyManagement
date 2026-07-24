import {Schema} from "mongoose";
import {IFeasibilityStudy} from "./feasibilityStudy";

export function applyFeasibilityStudyIndexes(schema: Schema<IFeasibilityStudy>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
