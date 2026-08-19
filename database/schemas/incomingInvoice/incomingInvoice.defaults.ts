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
import IncomingInvoice from "./incomingInvoice";

export async function createIncomingInvoices(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createIncomingInvoices", parentLogger);
    logger.start("Creating incoming invoices...");
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
    const cinv = extra.contractorInvoices?.get("cinv-03");
    if (project && currency) {
    {
        const seedKey = "ap-inbox";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(IncomingInvoice, company, name, {
            title: "ABG invoice 2026-03",
            project,
            extractedSupplierName: "Albanian Builders Group",
            extractedAmount: Decimal128.fromString("1850000"),
            extractedCurrencyCode: "EUR",
            extractedInvoiceNumber: "ABG-2026-031",
            extractedInvoiceDate: dayjs().subtract(20, "day").toDate(),
            matchedConstructor: constructorRef,
            matchedContract: contract,
            currency,
            createdContractorInvoice: cinv,
            ocrStatus: "done",
            status: "posted"
        }, logger, "incoming invoice");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping incoming invoice 'ap-inbox': required ref missing.");
    }

    logger.finish("Finished creating incoming invoices!", created.size);
    return created;
}
