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
import ApprovalRequest from "./approvalRequest";

export async function createApprovalRequests(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createApprovalRequests", parentLogger);
    logger.start("Creating approval requests...");
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

    const workflow = extra.approvalWorkflows?.get("awf-budget");
    const budget = extra.budgets?.get("budget-garda");
    if (workflow && budget && currency) {
    {
        const seedKey = "apr-budget";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ApprovalRequest, company, name, {
            workflow,
            documentType: "budget",
            targetType: "Budget",
            targetId: budget,
            amount: Decimal128.fromString("42000000"),
            currency,
            currentStage: "done",
            primaryDecision: "approved",
            escalationDecision: "approved",
            status: "approved",
            notes: "Garda construction budget approved."
        }, logger, "approval request");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping approval request 'apr-budget': required ref missing.");
    }

    logger.finish("Finished creating approval requests!", created.size);
    return created;
}
