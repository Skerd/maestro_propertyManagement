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
import CommissioningRecord from "./commissioningRecord";

export async function createCommissioningRecords(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createCommissioningRecords", parentLogger);
    logger.start("Creating commissioning records...");
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

    const pack = extra.handoverPackages?.get("handover-a102");
    if (ariaProject && user) {
    {
        const seedKey = "cx-hvac";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(CommissioningRecord, company, name, {
            title: "HVAC commissioning — A1-02",
            project: ariaProject,
            edifice: ariaEd,
            unit,
            handoverPackage: pack,
            inspectedBy: user,
            status: "passed",
            notes: "Airflow within tolerance."
        }, logger, "commissioning record");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping commissioning record 'cx-hvac': required ref missing.");
    }

    logger.finish("Finished creating commissioning records!", created.size);
    return created;
}
