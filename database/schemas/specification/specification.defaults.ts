import {Decimal128, ObjectId} from "mongodb";
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
import Specification from "./specification";

export async function createSpecifications(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createSpecifications", parentLogger);
    logger.start("Creating specifications...");
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

    const wp = extra.workPackages?.get("wp-structure");
    if (project && currency) {
    {
        const seedKey = "spec-npk";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Specification, company, name, {
            title: "Garda NPK specification — structure",
            project,
            edifice,
            workPackage: wp,
            currency,
            standard: "npk",
            totalEstimated: Decimal128.fromString("12800000"),
            status: "tender_ready",
            description: "Tender-ready NPK spec for the structure package."
        }, logger, "specification");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping specification 'spec-npk': required ref missing.");
    }

    logger.finish("Finished creating specifications!", created.size);
    return created;
}
