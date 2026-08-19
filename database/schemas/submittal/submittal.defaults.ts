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
import Submittal from "./submittal";

export async function createSubmittals(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createSubmittals", parentLogger);
    logger.start("Creating submittals...");
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
    if (project && user) {
    {
        const seedKey = "sub-rebar";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Submittal, company, name, {
            title: "Rebar shop drawings — core walls L12-L18",
            project,
            edifice,
            submittedBy: user2,
            reviewedBy: user,
            relatedDocument: planDoc,
            status: "approved"
        }, logger, "submittal");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping submittal 'sub-rebar': required ref missing.");
    }

    logger.finish("Finished creating submittals!", created.size);
    return created;
}
