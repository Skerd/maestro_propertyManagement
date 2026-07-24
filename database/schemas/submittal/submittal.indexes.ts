import {Schema} from "mongoose";
import {ISubmittal} from "./submittal";

export function applySubmittalIndexes(schema: Schema<ISubmittal>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
