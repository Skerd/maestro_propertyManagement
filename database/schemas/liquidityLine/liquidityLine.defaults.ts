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
import LiquidityLine from "./liquidityLine";

export async function createLiquidityLines(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createLiquidityLines", parentLogger);
    logger.start("Creating liquidity lines...");
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

    const plan = extra.liquidityPlans?.get("liq-garda");
    if (plan && currency) {
    {
        const seedKey = "liq-in-equity";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(LiquidityLine, company, name, {
            plan,
            currency,
            direction: "inflow",
            source: "owner_contract",
            title: "Owner equity draw 03",
            period: dayjs().startOf("month").toDate(),
            plannedAmount: Decimal128.fromString("2500000"),
            actualAmount: Decimal128.fromString("2500000")
        }, logger, "liquidity line");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping liquidity line 'liq-in-equity': required ref missing.");
    }
    if (plan && currency) {
    {
        const seedKey = "liq-out-claim";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(LiquidityLine, company, name, {
            plan,
            currency,
            direction: "outflow",
            source: "contractor_invoice",
            title: "Claim 03 payment",
            period: dayjs().startOf("month").toDate(),
            plannedAmount: Decimal128.fromString("1850000"),
            actualAmount: Decimal128.fromString("0")
        }, logger, "liquidity line");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping liquidity line 'liq-out-claim': required ref missing.");
    }

    logger.finish("Finished creating liquidity lines!", created.size);
    return created;
}
