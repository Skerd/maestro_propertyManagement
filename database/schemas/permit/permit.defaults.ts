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
import Permit from "./permit";

export async function createPermits(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createPermits", parentLogger);
    logger.start("Creating permits...");
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
        const seedKey = "permit-building";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Permit, company, name, {
            title: "Building permit — Garda Tower",
            project,
            edifice,
            permitType: "building",
            status: "approved",
            notes: "Issued by Tirana municipality."
        }, logger, "permit");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping permit 'permit-building': required ref missing.");
    }
    if (project) {
    {
        const seedKey = "permit-excavation";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Permit, company, name, {
            title: "Excavation permit — Garda basement",
            project,
            edifice,
            permitType: "excavation",
            status: "submitted"
        }, logger, "permit");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping permit 'permit-excavation': required ref missing.");
    }

    logger.finish("Finished creating permits!", created.size);
    return created;
}
