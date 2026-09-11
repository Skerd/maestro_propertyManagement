import {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {
    pmDemoName,
    upsertByName,
    aria,
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
    const ariaProject = aria(ctx);

    if (ariaProject) {
        const seedKey = "handover-a102";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(HandoverPackage, company, name, {
            title: "Aria handover checklist",
            project: ariaProject,
            edifice: null,
            floor: null,
            unit: null,
            notes: "Project-level keys, O&M and snag close-out.",
            items: [
                {name: "Keys transferred", description: "Unit keys handed to the buyer.", importance: "high"},
                {name: "O&M manuals", description: "Operation and maintenance manuals delivered.", importance: "medium"},
                {name: "Snag close-out", description: "Outstanding snags closed or accepted.", importance: "high"},
            ],
        }, logger, "handover package");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    } else {
        logger.warn("Skipping handover package 'handover-a102': required ref missing.");
    }

    logger.finish("Finished creating handover packages!", created.size);
    return created;
}
