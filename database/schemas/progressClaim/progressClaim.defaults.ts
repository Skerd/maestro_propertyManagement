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
import ProgressClaim from "./progressClaim";

export async function createProgressClaims(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createProgressClaims", parentLogger);
    logger.start("Creating progress claims...");
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
    if (project && contract && currency) {
    {
        const seedKey = "claim-03";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ProgressClaim, company, name, {
            title: "Progress claim 03 — frame to level 18",
            project,
            constructionContract: contract,
            currency,
            amount: Decimal128.fromString("1850000"),
            status: "certified",
            notes: "Certified by the QS."
        }, logger, "progress claim");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping progress claim 'claim-03': required ref missing.");
    }

    logger.finish("Finished creating progress claims!", created.size);
    return created;
}
