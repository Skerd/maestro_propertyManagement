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
import ConstructionContract from "./constructionContract";

export async function createConstructionContracts(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createConstructionContracts", parentLogger);
    logger.start("Creating construction contracts...");
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

    const wp = extra.workPackages?.get("wp-structure");
    if (project && constructorRef && currency) {
    {
        const seedKey = "contract-structure";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ConstructionContract, company, name, {
            title: "Garda structure & envelope contract",
            project,
            edifice,
            workPackage: wp,
            constructorRef,
            currency,
            contractValue: Decimal128.fromString("12480000"),
            retentionPercent: 5,
            paymentTerms: "Monthly certified claims, 30-day payment.",
            startDate: dayjs().subtract(12, "month").toDate(),
            endDate: dayjs().add(18, "month").toDate(),
            status: "active"
        }, logger, "construction contract");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping construction contract 'contract-structure': required ref missing.");
    }

    logger.finish("Finished creating construction contracts!", created.size);
    return created;
}
