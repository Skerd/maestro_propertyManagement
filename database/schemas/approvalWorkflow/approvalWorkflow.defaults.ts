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
import ApprovalWorkflow from "./approvalWorkflow";

export async function createApprovalWorkflows(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createApprovalWorkflows", parentLogger);
    logger.start("Creating approval workflows...");
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


    if (currency) {
    {
        const seedKey = "awf-budget";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ApprovalWorkflow, company, name, {
            title: "Budget approval (PM + MD)",
            documentType: "budget",
            approverRole: "project-manager",
            escalationRole: "managing-director",
            thresholdAmount: Decimal128.fromString("1000000"),
            thresholdCurrency: currency,
            active: true,
            notes: "Amounts above €1m escalate to the managing director."
        }, logger, "approval workflow");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping approval workflow 'awf-budget': required ref missing.");
    }
    {
        const seedKey = "awf-invoice";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ApprovalWorkflow, company, name, {
            title: "Contractor invoice approval",
            documentType: "contractor_invoice",
            approverRole: "qs",
            active: true
        }, logger, "approval workflow");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }

    logger.finish("Finished creating approval workflows!", created.size);
    return created;
}
