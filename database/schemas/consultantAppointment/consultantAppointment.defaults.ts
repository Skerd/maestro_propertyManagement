import {Decimal128, ObjectId} from "mongodb";
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
import ConsultantAppointment from "./consultantAppointment";

export async function createConsultantAppointments(
    parentLogger: serverLogger,
    company: ICompany,
    ctx: WorkflowCtx,
    extra: Record<string, Map<string, ObjectId>> = {},
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createConsultantAppointments", parentLogger);
    logger.start("Creating consultant appointments...");
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


    if (project && constructorRef) {
    {
        const seedKey = "consult-architect";
        const name = pmDemoName(seedKey);
        const doc = await upsertByName(ConsultantAppointment, company, name, {
            title: "Lead architect — Garda Tower",
            project,
            constructorRef,
            currency,
            role: "architect",
            feeModel: "sia_102",
            basisKind: "construction_cost",
            feeAmount: Decimal128.fromString("840000"),
            startDate: dayjs().subtract(18, "month").toDate(),
            status: "active",
            scope: "Concept through construction documents."
        }, logger, "consultant appointment");
        if (doc?._id) created.set(seedKey, doc._id as ObjectId);
    }
    } else {
        logger.warn("Skipping consultant appointment 'consult-architect': required ref missing.");
    }

    logger.finish("Finished creating consultant appointments!", created.size);
    return created;
}
