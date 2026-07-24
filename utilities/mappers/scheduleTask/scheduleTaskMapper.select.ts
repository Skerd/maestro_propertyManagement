import type {IScheduleTask} from "../../../database/schemas/scheduleTask/scheduleTask";

export function scheduleTasksToSelect(docs: IScheduleTask[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
