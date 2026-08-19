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
import LandParcel from "./landParcel";

export async function createLandParcels(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createLandParcels", parentLogger);
    logger.start("Creating land parcels...");
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
        const seedKey = "land-garda";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(LandParcel, company, name, {
            title: "Garda Tower plot — Presidency block",
            project,
            cadastralReference: "TR-1021-GARDA-01",
            areaSqm: 4200,
            zoning: "mixed-use high-rise",
            currency,
            acquisitionCost: Decimal128.fromString("8500000"),
            dueDiligenceStatus: "complete",
            description: "Primary plot for Garda Tower next to the Presidency.",
            status: "acquired"
        }, logger, "land parcel");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping land parcel 'land-garda': required ref missing.");
    }
    if (ariaProject && currency) {
    {
        const seedKey = "land-aria";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(LandParcel, company, name, {
            title: "Aria Residence hillside parcel",
            project: ariaProject,
            cadastralReference: "VL-DHERMI-ARIA-01",
            areaSqm: 6800,
            zoning: "coastal residential",
            currency,
            acquisitionCost: Decimal128.fromString("2100000"),
            status: "acquired"
        }, logger, "land parcel");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping land parcel 'land-aria': required ref missing.");
    }

    logger.finish("Finished creating land parcels!", created.size);
    return created;
}
