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
import Budget from "./budget";

export async function createBudgets(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createBudgets", parentLogger);
    logger.start("Creating budgets...");
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
        const seedKey = "budget-garda";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Budget, company, name, {
            title: "Garda Tower construction budget v1",
            project,
            edifice,
            currency,
            version: 1,
            method: "ebkp_h",
            classificationStandard: "ebkp_h",
            approvedTotal: Decimal128.fromString("42000000"),
            contingencyPercent: 8,
            status: "approved",
            description: "Approved construction budget for Garda Tower."
        }, logger, "budget");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping budget 'budget-garda': required ref missing.");
    }

    logger.finish("Finished creating budgets!", created.size);
    return created;
}
