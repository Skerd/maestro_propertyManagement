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
import DesignStage from "./designStage";

export async function createDesignStages(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createDesignStages", parentLogger);
    logger.start("Creating design stages...");
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
        const seedKey = "design-concept";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(DesignStage, company, name, {
            title: "Concept",
            project,
            edifice,
            stageType: "concept",
            status: "completed"
        }, logger, "design stage");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping design stage 'design-concept': required ref missing.");
    }
    if (project) {
    {
        const seedKey = "design-dd";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(DesignStage, company, name, {
            title: "Design development",
            project,
            edifice,
            stageType: "design_development",
            status: "in_progress"
        }, logger, "design stage");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping design stage 'design-dd': required ref missing.");
    }

    logger.finish("Finished creating design stages!", created.size);
    return created;
}
