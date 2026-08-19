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
import TenderInvitation from "./tenderInvitation";

export async function createTenderInvitations(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createTenderInvitations", parentLogger);
    logger.start("Creating tender invitations...");
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
    if (tender && constructorRef) {
    {
        const seedKey = "invite-abg";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(TenderInvitation, company, name, {
            tender,
            constructorRef,
            invitedAt: dayjs().subtract(90, "day").toDate(),
            respondedAt: dayjs().subtract(60, "day").toDate(),
            status: "submitted"
        }, logger, "tender invitation");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping tender invitation 'invite-abg': required ref missing.");
    }
    if (tender && constructor2) {
    {
        const seedKey = "invite-med";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(TenderInvitation, company, name, {
            tender,
            constructorRef: constructor2,
            invitedAt: dayjs().subtract(90, "day").toDate(),
            respondedAt: dayjs().subtract(55, "day").toDate(),
            status: "submitted"
        }, logger, "tender invitation");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping tender invitation 'invite-med': required ref missing.");
    }

    logger.finish("Finished creating tender invitations!", created.size);
    return created;
}
