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
import Tender from "./tender";

export async function createTenders(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createTenders", parentLogger);
    logger.start("Creating tenders...");
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

    const spec = extra.specifications?.get("spec-npk");
    if (project && spec) {
    {
        const seedKey = "tender-structure";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Tender, company, name, {
            title: "Structure package tender",
            project,
            edifice,
            specification: spec,
            status: "awarded",
            notes: "Awarded to Albanian Builders Group."
        }, logger, "tender");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping tender 'tender-structure': required ref missing.");
    }

    logger.finish("Finished creating tenders!", created.size);
    return created;
}
