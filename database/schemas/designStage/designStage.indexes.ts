import {Schema} from "mongoose";
import {IDesignStage} from "./designStage";

export function applyDesignStageIndexes(schema: Schema<IDesignStage>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
