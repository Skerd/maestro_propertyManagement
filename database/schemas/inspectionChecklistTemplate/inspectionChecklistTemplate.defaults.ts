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
import InspectionChecklistTemplate from "./inspectionChecklistTemplate";

export async function createInspectionChecklistTemplates(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createInspectionChecklistTemplates", parentLogger);
    logger.start("Creating inspection checklist templates...");
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


    {
        const seedKey = "chk-handover";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(InspectionChecklistTemplate, company, name, {
            title: "Unit handover checklist",
            trade: "finishes",
            stage: "handover",
            description: "Standard snagging checklist used at practical completion.",
            itemsJson: "[{\"item\":\"Doors and ironmongery\"},{\"item\":\"Sanitaryware\"},{\"item\":\"HVAC outlets\"}]",
            status: "active"
        }, logger, "inspection checklist template");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }

    logger.finish("Finished creating inspection checklist templates!", created.size);
    return created;
}
