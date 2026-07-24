import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import dayjs from "dayjs";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {generateWorkOrderMaintenancePlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/generateWorkOrderMaintenancePlan.form.validator";
import MaintenancePlan from "./maintenancePlan";
import MaintenanceWorkOrder from "../maintenanceWorkOrder/maintenanceWorkOrder";
import {maintenancePlanService} from "./maintenancePlan.service";
import {maintenancePlanToDTO} from "@propertyManagement/utilities/mappers/maintenancePlan/maintenancePlanMapper.dto";

export class MaintenancePlanActions {
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 20}, transaction: true, schema: generateWorkOrderMaintenancePlanFormSchema})
    async generateWorkOrder(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`MaintenancePlan.generateWorkOrder ` + String(_id) + `...`);
        const plan = await maintenancePlanService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        const date = dayjs().format("YYYYMMDD");
        const [wo] = await MaintenanceWorkOrder.create([{
            name: `MWO-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            plan: plan._id,
            asset: plan.asset ?? undefined,
            edifice: plan.edifice ?? undefined,
            title: plan.title,
            type: plan.planType === "renovation" ? "renovation" : "preventive",
            dueDate: plan.nextDueAt ?? undefined,
            status: "open",
            company: company._id,
            createdBy: actionUserCtx.userId,
        }], {session});
        // Advance the plan's next due date by its interval.
        if (plan.intervalDays && plan.nextDueAt) {
            const next = dayjs(plan.nextDueAt).add(Number(plan.intervalDays), "day").toDate();
            await maintenancePlanService.updateByIdOrThrow(plan._id, {$set: {nextDueAt: next}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        }
        logger.finish(`MaintenancePlan.generateWorkOrder done — ${String(wo._id)}`);
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("maintenanceplans").readFields!, MaintenancePlan.schema);
            const updated = await maintenancePlanService.findById(plan._id, {session, logger, languageCode}, populate.populate);
            if (updated) return maintenancePlanToDTO(updated);
        } catch { /* no read */ }
        return {workOrderId: String(wo._id)};
    }
}
