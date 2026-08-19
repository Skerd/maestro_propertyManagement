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
import WorkPackage from "./workPackage";

export async function createWorkPackages(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createWorkPackages", parentLogger);
    logger.start("Creating work packages...");
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


    if (project && constructorRef) {
    {
        const seedKey = "wp-structure";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(WorkPackage, company, name, {
            title: "Structure & envelope",
            project,
            edifice,
            constructorRef,
            status: "active",
            notes: "Concrete frame, facade and roof."
        }, logger, "work package");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping work package 'wp-structure': required ref missing.");
    }

    logger.finish("Finished creating work packages!", created.size);
    return created;
}
