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
import HandoverPackage from "./handoverPackage";

export async function createHandoverPackages(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createHandoverPackages", parentLogger);
    logger.start("Creating handover packages...");
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


    if (ariaProject && unit) {
    {
        const seedKey = "handover-a102";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(HandoverPackage, company, name, {
            title: "Handover pack — sold unit A1-02",
            project: ariaProject,
            edifice: ariaEd,
            unit,
            status: "in_progress",
            notes: "Keys, O&M and snag close-out for the cash sale unit."
        }, logger, "handover package");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping handover package 'handover-a102': required ref missing.");
    }

    logger.finish("Finished creating handover packages!", created.size);
    return created;
}
