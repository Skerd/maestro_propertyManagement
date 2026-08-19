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
import BimModel from "./bimModel";

export async function createBimModels(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createBimModels", parentLogger);
    logger.start("Creating BIM models...");
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
        const seedKey = "bim-garda";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(BimModel, company, name, {
            title: "Garda Tower federated model",
            project,
            edifice,
            version: "2026.2",
            importStatus: "imported",
            notes: "Architecture + structure federation. No source IFC committed."
        }, logger, "BIM model");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping BIM model 'bim-garda': required ref missing.");
    }

    logger.finish("Finished creating BIM models!", created.size);
    return created;
}
