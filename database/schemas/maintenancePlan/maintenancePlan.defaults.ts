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
import MaintenancePlan from "./maintenancePlan";

export async function createMaintenancePlans(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createMaintenancePlans", parentLogger);
    logger.start("Creating maintenance plans...");
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

    const asset = extra.assets?.get("asset-lift");
    if (edifice) {
    {
        const seedKey = "mpl-lift";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(MaintenancePlan, company, name, {
            title: "Quarterly lift service",
            asset,
            edifice,
            planType: "statutory",
            intervalDays: 90,
            nextDueAt: dayjs().add(20, "day").toDate(),
            responsibleParty: "Schindler Albania",
            active: true
        }, logger, "maintenance plan");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping maintenance plan 'mpl-lift': required ref missing.");
    }

    logger.finish("Finished creating maintenance plans!", created.size);
    return created;
}
