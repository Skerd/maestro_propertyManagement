import {ObjectId} from "mongodb";
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
import BimQuantity from "./bimQuantity";

export async function createBimQuantities(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createBimQuantities", parentLogger);
    logger.start("Creating BIM quantities...");
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

    const bim = extra.bimModels?.get("bim-garda");
    if (bim) {
    {
        const seedKey = "bq-walls";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(BimQuantity, company, name, {
            bimModel: bim,
            ifcElementType: "IfcWall",
            classificationCode: "C2.1",
            quantity: 1840,
            unitOfMeasure: "m2",
            notes: "External wall area from federated model."
        }, logger, "BIM quantity");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping BIM quantity 'bq-walls': required ref missing.");
    }

    logger.finish("Finished creating BIM quantities!", created.size);
    return created;
}
