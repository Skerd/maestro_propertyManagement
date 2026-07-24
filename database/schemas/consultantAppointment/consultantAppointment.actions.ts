import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {activateConsultantAppointmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/consultantAppointment/activateConsultantAppointment.form.validator";
import {completeConsultantAppointmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/consultantAppointment/completeConsultantAppointment.form.validator";
import {terminateConsultantAppointmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/consultantAppointment/terminateConsultantAppointment.form.validator";
import ConsultantAppointment from "./consultantAppointment";
import {consultantAppointmentService} from "./consultantAppointment.service";
import {consultantAppointmentToDTO} from "@propertyManagement/utilities/mappers/consultantAppointment/consultantAppointmentMapper.dto";

export class ConsultantAppointmentActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: activateConsultantAppointmentFormSchema})
    async activate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConsultantAppointment.activate ` + String(_id) + `...`);
        const existing = await consultantAppointmentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_activate", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "active"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await consultantAppointmentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("consultantappointments").readFields!, ConsultantAppointment.schema);
            const updated = await consultantAppointmentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return consultantAppointmentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConsultantAppointment.activate done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: completeConsultantAppointmentFormSchema})
    async complete(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConsultantAppointment.complete ` + String(_id) + `...`);
        const existing = await consultantAppointmentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["active"].includes(status)) {
            throw apiValidationException("invalid_status_for_complete", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "completed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await consultantAppointmentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("consultantappointments").readFields!, ConsultantAppointment.schema);
            const updated = await consultantAppointmentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return consultantAppointmentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConsultantAppointment.complete done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: terminateConsultantAppointmentFormSchema})
    async terminate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConsultantAppointment.terminate ` + String(_id) + `...`);
        const existing = await consultantAppointmentService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft", "active"].includes(status)) {
            throw apiValidationException("invalid_status_for_terminate", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "terminated"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await consultantAppointmentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("consultantappointments").readFields!, ConsultantAppointment.schema);
            const updated = await consultantAppointmentService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return consultantAppointmentToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConsultantAppointment.terminate done`);
        return undefined;
    }
}
