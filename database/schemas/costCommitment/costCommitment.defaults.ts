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
import CostCommitment from "./costCommitment";

export async function createCostCommitments(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createCostCommitments", parentLogger);
    logger.start("Creating cost commitments...");
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
    if (project && constructorRef && currency) {
    {
        const seedKey = "commit-structure";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(CostCommitment, company, name, {
            title: "Structure package commitment",
            project,
            edifice,
            budget,
            constructorRef,
            currency,
            committedAmount: Decimal128.fromString("12500000"),
            status: "issued",
            notes: "Committed against the approved Garda budget."
        }, logger, "cost commitment");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping cost commitment 'commit-structure': required ref missing.");
    }

    logger.finish("Finished creating cost commitments!", created.size);
    return created;
}
