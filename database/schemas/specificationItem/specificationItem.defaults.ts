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
import SpecificationItem from "./specificationItem";

export async function createSpecificationItems(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createSpecificationItems", parentLogger);
    logger.start("Creating specification items...");
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

    const spec = extra.specifications?.get("spec-npk");
    if (spec && currency) {
    {
        const seedKey = "specitem-concrete";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(SpecificationItem, company, name, {
            title: "C30/37 in-situ concrete",
            specification: spec,
            project,
            currency,
            npkChapter: "241",
            npkPosition: "241.111",
            unitOfMeasure: "m3",
            quantity: 9200,
            unitPrice: Decimal128.fromString("185"),
            lineTotal: Decimal128.fromString("1702000"),
            classificationStandard: "npk",
            sortIndex: 1,
            status: "active"
        }, logger, "specification item");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping specification item 'specitem-concrete': required ref missing.");
    }

    logger.finish("Finished creating specification items!", created.size);
    return created;
}
