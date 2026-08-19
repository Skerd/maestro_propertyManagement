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
import Milestone from "./milestone";

export async function createMilestones(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createMilestones", parentLogger);
    logger.start("Creating milestones...");
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


    if (project) {
    {
        const seedKey = "ms-topping";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Milestone, company, name, {
            title: "Topping out",
            project,
            edifice,
            status: "planned",
            notes: "Structure complete to roof slab."
        }, logger, "milestone");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping milestone 'ms-topping': required ref missing.");
    }
    if (project) {
    {
        const seedKey = "ms-envelope";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Milestone, company, name, {
            title: "Envelope watertight",
            project,
            edifice,
            status: "in_progress"
        }, logger, "milestone");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping milestone 'ms-envelope': required ref missing.");
    }

    logger.finish("Finished creating milestones!", created.size);
    return created;
}
