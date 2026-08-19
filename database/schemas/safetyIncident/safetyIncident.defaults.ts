import {ObjectId} from "mongodb";
import dayjs from "dayjs";
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
import SafetyIncident from "./safetyIncident";

export async function createSafetyIncidents(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createSafetyIncidents", parentLogger);
    logger.start("Creating safety incidents...");
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


    if (project && user2) {
    {
        const seedKey = "hse-near-miss";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(SafetyIncident, company, name, {
            title: "Near miss — unsecured edge at L14",
            project,
            edifice,
            reportedBy: user2,
            severity: "medium",
            incidentDate: dayjs().subtract(12, "day").toDate(),
            description: "Operative approached an unsecured slab edge. Work stopped, barrier reinstated.",
            status: "closed"
        }, logger, "safety incident");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping safety incident 'hse-near-miss': required ref missing.");
    }

    logger.finish("Finished creating safety incidents!", created.size);
    return created;
}
