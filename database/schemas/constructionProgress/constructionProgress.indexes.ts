import {Schema} from "mongoose";

export function applyConstructionProgressIndexes(schema: Schema): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({project: 1, updateDate: -1});
    schema.index({edifice: 1, updateDate: -1});
}
