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
import Asset from "./asset";

export async function createAssets(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createAssets", parentLogger);
    logger.start("Creating assets...");
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

    const warranty = extra.warranties?.get("warranty-structure");
    if (edifice) {
    {
        const seedKey = "asset-lift";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Asset, company, name, {
            title: "Passenger lift bank — Garda core",
            edifice,
            warranty,
            category: "vertical-transport",
            manufacturer: "Schindler",
            serial: "SCH-GARDA-L1",
            installDate: dayjs().subtract(2, "month").toDate(),
            lifecycleStatus: "active"
        }, logger, "asset");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping asset 'asset-lift': required ref missing.");
    }

    logger.finish("Finished creating assets!", created.size);
    return created;
}
