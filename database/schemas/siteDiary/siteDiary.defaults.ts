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
import SiteDiary from "./siteDiary";

export async function createSiteDiaries(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createSiteDiaries", parentLogger);
    logger.start("Creating site diaries...");
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


    if (project) {
    {
        const seedKey = "diary-today";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(SiteDiary, company, name, {
            title: "Site diary — concrete pour L14",
            project,
            edifice,
            diaryDate: dayjs().subtract(1, "day").toDate(),
            status: "published",
            notes: "Night pour completed; 180 m3 placed."
        }, logger, "site diary");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping site diary 'diary-today': required ref missing.");
    }

    logger.finish("Finished creating site diaries!", created.size);
    return created;
}
