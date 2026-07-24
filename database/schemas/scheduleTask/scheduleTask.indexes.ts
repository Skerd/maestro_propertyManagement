import {Schema} from "mongoose";
import {IScheduleTask} from "./scheduleTask";

export function applyScheduleTaskIndexes(schema: Schema<IScheduleTask>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({project: 1, status: 1});
    schema.index({milestone: 1, status: 1});
    schema.index({assignee: 1, status: 1});
    schema.index({status: 1, plannedEnd: 1});
    schema.index({plannedEnd: 1, status: 1});
}
