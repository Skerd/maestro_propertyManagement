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
import Rfi from "./rfi";

export async function createRfis(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createRfis", parentLogger);
    logger.start("Creating RFIs...");
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
        const seedKey = "rfi-core";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Rfi, company, name, {
            title: "Lift-shaft wall thickness at L12",
            question: "Confirm whether the core wall at grid C thickens from 300 to 350 mm above L12.",
            project,
            edifice,
            askedBy: user2,
            answeredBy: user,
            relatedDocument: planDoc,
            status: "answered",
            notes: "Remain 300 mm; clash is a model error."
        }, logger, "RFI");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping RFI 'rfi-core': required ref missing.");
    }

    logger.finish("Finished creating RFIs!", created.size);
    return created;
}
