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
import ContractorInvoice from "./contractorInvoice";

export async function createContractorInvoices(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createContractorInvoices", parentLogger);
    logger.start("Creating contractor invoices...");
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
    const claim = extra.progressClaims?.get("claim-03");
    const commit = extra.costCommitments?.get("commit-structure");
    if (project && constructorRef && currency) {
    {
        const seedKey = "cinv-03";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ContractorInvoice, company, name, {
            project,
            edifice,
            constructorRef,
            constructionContract: contract,
            costCommitment: commit,
            progressClaim: claim,
            currency,
            invoiceNumber: "ABG-2026-031",
            invoiceDate: dayjs().subtract(20, "day").toDate(),
            dueDate: dayjs().add(10, "day").toDate(),
            grossAmount: Decimal128.fromString("1850000"),
            netAmount: Decimal128.fromString("1850000"),
            vatAmount: Decimal128.fromString("0"),
            retentionHeld: Decimal128.fromString("92500"),
            source: "manual",
            status: "approved",
            notes: "Invoice against certified claim 03."
        }, logger, "contractor invoice");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping contractor invoice 'cinv-03': required ref missing.");
    }

    logger.finish("Finished creating contractor invoices!", created.size);
    return created;
}
