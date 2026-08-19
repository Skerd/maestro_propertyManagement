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
import ProjectDocument from "./projectDocument";

export async function createProjectDocuments(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createProjectDocuments", parentLogger);
    logger.start("Creating project documents...");
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

    const design = extra.designStages?.get("design-dd");
    if (project) {
    {
        const seedKey = "doc-ga-plan";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ProjectDocument, company, name, {
            title: "Garda Tower GA plan Rev C",
            project,
            edifice,
            discipline: "architectural",
            documentType: "drawing",
            designStage: design,
            status: "approved",
            notes: "Current general arrangement for the podium and typical floors."
        }, logger, "project document");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping project document 'doc-ga-plan': required ref missing.");
    }

    logger.finish("Finished creating project documents!", created.size);
    return created;
}
