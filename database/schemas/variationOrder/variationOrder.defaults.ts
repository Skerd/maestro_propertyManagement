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
import VariationOrder from "./variationOrder";

export async function createVariationOrders(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createVariationOrders", parentLogger);
    logger.start("Creating variation orders...");
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

    const contract = extra.constructionContracts?.get("contract-structure");
    if (project && contract) {
    {
        const seedKey = "vo-facade";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(VariationOrder, company, name, {
            title: "Facade aluminium alternative",
            description: "Switch podium facade from stone to aluminium cassette to recover programme.",
            project,
            edifice,
            constructionContract: contract,
            currency,
            costImpact: Decimal128.fromString("180000"),
            timeImpactDays: -14,
            status: "approved",
            notes: "Client accepted the aluminium alternative from the awarded bid."
        }, logger, "variation order");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping variation order 'vo-facade': required ref missing.");
    }

    logger.finish("Finished creating variation orders!", created.size);
    return created;
}
