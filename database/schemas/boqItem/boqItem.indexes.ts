import {Schema} from "mongoose";
import {IBoqItem} from "./boqItem";

export function applyBoqItemIndexes(schema: Schema<IBoqItem>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
