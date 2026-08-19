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
import FeasibilityStudy from "./feasibilityStudy";

export async function createFeasibilityStudies(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createFeasibilityStudies", parentLogger);
    logger.start("Creating feasibility studies...");
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

    const land = extra.landParcels?.get("land-garda");
    if (project && currency) {
    {
        const seedKey = "feas-garda";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(FeasibilityStudy, company, name, {
            title: "Garda Tower feasibility",
            project,
            landParcel: land,
            currency,
            decidedBy: user,
            notes: "Approved to proceed to schematic design.",
            status: "approved"
        }, logger, "feasibility study");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping feasibility study 'feas-garda': required ref missing.");
    }

    logger.finish("Finished creating feasibility studies!", created.size);
    return created;
}
