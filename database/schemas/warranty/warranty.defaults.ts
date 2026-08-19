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
import Warranty from "./warranty";

export async function createWarranties(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createWarranties", parentLogger);
    logger.start("Creating warranties...");
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
        const seedKey = "warranty-structure";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(Warranty, company, name, {
            title: "Structural warranty — Garda Tower",
            project,
            edifice,
            currency,
            startDate: dayjs().subtract(1, "month").toDate(),
            endDate: dayjs().add(10, "year").toDate(),
            status: "active",
            notes: "10-year structural warranty on the Garda frame and core."
        }, logger, "warranty");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping warranty 'warranty-structure': required ref missing.");
    }

    logger.finish("Finished creating warranties!", created.size);
    return created;
}
