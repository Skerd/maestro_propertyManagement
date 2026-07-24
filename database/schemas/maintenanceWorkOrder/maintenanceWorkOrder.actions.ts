import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {assignMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/assignMaintenanceWorkOrder.form.validator";
import {startMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/startMaintenanceWorkOrder.form.validator";
import {completeMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/completeMaintenanceWorkOrder.form.validator";
import {verifyMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/verifyMaintenanceWorkOrder.form.validator";
import {closeMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/closeMaintenanceWorkOrder.form.validator";
import {cancelMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/cancelMaintenanceWorkOrder.form.validator";
import MaintenanceWorkOrder from "./maintenanceWorkOrder";
import {maintenanceWorkOrderService} from "./maintenanceWorkOrder.service";
import {maintenanceWorkOrderToDTO} from "@propertyManagement/utilities/mappers/maintenanceWorkOrder/maintenanceWorkOrderMapper.dto";

async function transition(params: Record<string, any>, label: string, from: string[], next: string): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
    const existing = await maintenanceWorkOrderService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
    if (!from.includes(existing.status ?? "open")) {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    const $set: Record<string, any> = {status: next};
    if (notes !== undefined && notes !== null && String(notes).trim()) {
        const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
        const n = String(notes).trim();
        $set.notes = prev ? (prev + "\n-----\n" + n) : n;
    }
    await maintenanceWorkOrderService.updateByIdOrThrow(existing._id, {$set}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("maintenanceworkorders").readFields!, MaintenanceWorkOrder.schema);
        const updated = await maintenanceWorkOrderService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return maintenanceWorkOrderToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

export class MaintenanceWorkOrderActions {
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: assignMaintenanceWorkOrderFormSchema})
    async assign(params: Record<string, any>): Promise<any> { return transition(params, "assign", ["open"], "assigned"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: startMaintenanceWorkOrderFormSchema})
    async start(params: Record<string, any>): Promise<any> { return transition(params, "start", ["assigned", "open"], "in_progress"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: completeMaintenanceWorkOrderFormSchema})
    async complete(params: Record<string, any>): Promise<any> { return transition(params, "complete", ["in_progress"], "done"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: verifyMaintenanceWorkOrderFormSchema})
    async verify(params: Record<string, any>): Promise<any> { return transition(params, "verify", ["done"], "verified"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: closeMaintenanceWorkOrderFormSchema})
    async close(params: Record<string, any>): Promise<any> { return transition(params, "close", ["verified", "done"], "closed"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: cancelMaintenanceWorkOrderFormSchema})
    async cancel(params: Record<string, any>): Promise<any> { return transition(params, "cancel", ["open", "assigned", "in_progress"], "cancelled"); }
}
