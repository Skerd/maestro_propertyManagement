import {Schema} from "mongoose";
import {IMilestone} from "./milestone";

export function applyMilestoneIndexes(schema: Schema<IMilestone>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({project: 1, status: 1});
    schema.index({edifice: 1, status: 1});
    schema.index({status: 1, plannedEnd: 1});
    schema.index({plannedEnd: 1, status: 1});
}
