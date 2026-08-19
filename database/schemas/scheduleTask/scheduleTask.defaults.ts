import {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {
    pmDemoName,
    upsertByName,
    garda,
    gardaEdifice,
    aria,
    ariaEdifice,
    soldUnit,
    builder,
    builder2,
    eur,
    echo,
    almir,
    type WorkflowCtx,
} from "@propertyManagement/database/seeds/workflow/workflowDemo";
import ScheduleTask from "./scheduleTask";

export async function createScheduleTasks(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createScheduleTasks", parentLogger);
    logger.start("Creating schedule tasks...");
    const created = new Map<string, ObjectId>();
    const project = garda(ctx);
    const edifice = gardaEdifice(ctx);
    const currency = eur(ctx);
    const constructorRef = builder(ctx);
    const constructor2 = builder2(ctx);
    const user = echo(ctx);
    const user2 = almir(ctx);
    const unit = soldUnit(ctx);
    const ariaProject = aria(ctx);
    const ariaEd = ariaEdifice(ctx);

    const topping = extra.milestones?.get("ms-topping");
    if (project) {
    {
        const seedKey = "task-frame";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ScheduleTask, company, name, {
            title: "Climbing formwork — levels 12–24",
            project,
            edifice,
            milestone: topping,
            assignee: user,
            status: "in_progress",
            notes: "On the critical path to topping out."
        }, logger, "schedule task");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping schedule task 'task-frame': required ref missing.");
    }

    logger.finish("Finished creating schedule tasks!", created.size);
    return created;
}
