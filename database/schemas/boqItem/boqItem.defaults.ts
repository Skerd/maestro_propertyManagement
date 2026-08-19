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
import BoqItem from "./boqItem";

export async function createBoqItems(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createBoqItems", parentLogger);
    logger.start("Creating BoQ items...");
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

    const budget = extra.budgets?.get("budget-garda");
    if (budget && project && currency) {
    {
        const seedKey = "boq-structure";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(BoqItem, company, name, {
            title: "In-situ concrete frame",
            budget,
            project,
            edifice,
            constructorRef,
            currency,
            classificationStandard: "ebkp_h",
            classificationCode: "C",
            trade: "structure",
            unitOfMeasure: "m3",
            plannedQty: 9200,
            plannedRate: Decimal128.fromString("185"),
            plannedAmount: Decimal128.fromString("1702000"),
            status: "active"
        }, logger, "BoQ item");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping BoQ item 'boq-structure': required ref missing.");
    }

    logger.finish("Finished creating BoQ items!", created.size);
    return created;
}
