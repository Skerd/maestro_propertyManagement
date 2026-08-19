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
import PlanMarkup from "./planMarkup";

export async function createPlanMarkups(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createPlanMarkups", parentLogger);
    logger.start("Creating plan markups...");
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

    const planDoc = extra.projectDocuments?.get("doc-ga-plan");
    if (planDoc) {
    {
        const seedKey = "markup-core";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(PlanMarkup, company, name, {
            title: "Core wall clash on grid C",
            planDocument: planDoc,
            project,
            markerType: "defect",
            page: 1,
            geometryX: 0.42,
            geometryY: 0.31,
            geometryW: 0.08,
            geometryH: 0.06,
            description: "Structural wall overlaps the lift shaft on level 12.",
            assignee: user2,
            status: "open"
        }, logger, "plan markup");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping plan markup 'markup-core': required ref missing.");
    }

    logger.finish("Finished creating plan markups!", created.size);
    return created;
}
