import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ScheduleTask, {IScheduleTask} from "./scheduleTask";

export class ScheduleTaskService extends BaseCrudService<IScheduleTask, typeof ScheduleTask> {
    constructor() {
        super(ScheduleTask, "ScheduleTask");
    }
}

export const scheduleTaskService = new ScheduleTaskService();
