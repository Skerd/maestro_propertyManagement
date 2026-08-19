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
import BidLine from "./bidLine";

export async function createBidLines(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createBidLines", parentLogger);
    logger.start("Creating bid lines...");
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

    const bidDoc = extra.bids?.get("bid-abg");
    const specItem = extra.specificationItems?.get("specitem-concrete");
    if (bidDoc && specItem && currency) {
    {
        const seedKey = "bidline-concrete";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(BidLine, company, name, {
            bid: bidDoc,
            specificationItem: specItem,
            currency,
            title: "C30/37 in-situ concrete",
            quantity: 9200,
            unitPrice: Decimal128.fromString("178"),
            lineTotal: Decimal128.fromString("1637600"),
            sortIndex: 1
        }, logger, "bid line");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping bid line 'bidline-concrete': required ref missing.");
    }

    logger.finish("Finished creating bid lines!", created.size);
    return created;
}
