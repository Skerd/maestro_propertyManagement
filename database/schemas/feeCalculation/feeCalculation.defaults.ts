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
import FeeCalculation from "./feeCalculation";

export async function createFeeCalculations(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createFeeCalculations", parentLogger);
    logger.start("Creating fee calculations...");
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

    const appointment = extra.consultantAppointments?.get("consult-architect");
    if (appointment && currency) {
    {
        const seedKey = "fee-sia102";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(FeeCalculation, company, name, {
            consultantAppointment: appointment,
            currency,
            basisAmount: Decimal128.fromString("42000000"),
            feePercent: 2,
            adjustmentFactor: 1,
            totalFee: Decimal128.fromString("840000"),
            status: "earned",
            notes: "SIA 102 fee on the approved construction cost."
        }, logger, "fee calculation");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping fee calculation 'fee-sia102': required ref missing.");
    }

    logger.finish("Finished creating fee calculations!", created.size);
    return created;
}
