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
import LiquidityPlan from "./liquidityPlan";

export async function createLiquidityPlans(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createLiquidityPlans", parentLogger);
    logger.start("Creating liquidity plans...");
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


    if (project && currency) {
    {
        const seedKey = "liq-garda";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(LiquidityPlan, company, name, {
            title: "Garda 24-month cash plan",
            project,
            currency,
            horizonStart: dayjs().startOf("month").toDate(),
            horizonEnd: dayjs().add(24, "month").toDate(),
            granularity: "monthly",
            notes: "Owner equity inflows vs structure package outflows."
        }, logger, "liquidity plan");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping liquidity plan 'liq-garda': required ref missing.");
    }

    logger.finish("Finished creating liquidity plans!", created.size);
    return created;
}
