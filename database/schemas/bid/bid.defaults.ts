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
import Bid from "./bid";

export async function createBids(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createBids", parentLogger);
    logger.start("Creating bids...");
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

    const tender = extra.tenders?.get("tender-structure");
    const inviteAbg = extra.tenderInvitations?.get("invite-abg");
    const inviteMed = extra.tenderInvitations?.get("invite-med");
    if (tender && constructorRef && currency) {
    {
        const seedKey = "bid-abg";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Bid, company, name, {
            tender,
            tenderInvitation: inviteAbg,
            constructorRef,
            currency,
            total: Decimal128.fromString("12480000"),
            submittedAt: dayjs().subtract(60, "day").toDate(),
            coveringNotes: "Includes facade alternative in aluminium.",
            status: "awarded"
        }, logger, "bid");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping bid 'bid-abg': required ref missing.");
    }
    if (tender && constructor2 && currency) {
    {
        const seedKey = "bid-med";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Bid, company, name, {
            tender,
            tenderInvitation: inviteMed,
            constructorRef: constructor2,
            currency,
            total: Decimal128.fromString("13100000"),
            submittedAt: dayjs().subtract(55, "day").toDate(),
            status: "rejected"
        }, logger, "bid");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping bid 'bid-med': required ref missing.");
    }

    logger.finish("Finished creating bids!", created.size);
    return created;
}
