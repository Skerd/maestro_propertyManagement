import {Decimal128, ObjectId} from "mongodb";
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
import MaintenanceWorkOrder from "./maintenanceWorkOrder";

export async function createMaintenanceWorkOrders(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createMaintenanceWorkOrders", parentLogger);
    logger.start("Creating maintenance work orders...");
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

    const plan = extra.maintenancePlans?.get("mpl-lift");
    const asset = extra.assets?.get("asset-lift");
    if (edifice) {
    {
        const seedKey = "mwo-lift-q1";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(MaintenanceWorkOrder, company, name, {
            title: "Q1 lift statutory service",
            plan,
            asset,
            edifice,
            assignee: constructorRef,
            currency,
            type: "preventive",
            costEstimate: Decimal128.fromString("1200"),
            dueDate: dayjs().add(20, "day").toDate(),
            status: "open"
        }, logger, "maintenance work order");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping maintenance work order 'mwo-lift-q1': required ref missing.");
    }

    logger.finish("Finished creating maintenance work orders!", created.size);
    return created;
}
