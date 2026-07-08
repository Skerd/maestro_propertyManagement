import {Schema} from "mongoose";

export function applyConstructionUpdateIndexes(schema: Schema): void {
    schema.index({name: 1}, {unique: true});
    schema.index({project: 1, updateDate: -1});
    schema.index({edifice: 1, updateDate: -1});
    schema.index({project: 1, progressPercent: -1});
}
