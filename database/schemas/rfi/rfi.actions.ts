import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {answerRfiFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/answerRfi.form.validator";
import {closeRfiFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/closeRfi.form.validator";
import {voidRfiFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/voidRfi.form.validator";
import Rfi from "./rfi";
import {rfiService} from "./rfi.service";
import {rfiToDTO} from "@propertyManagement/utilities/mappers/rfi/rfiMapper.dto";

export class RfiActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: answerRfiFormSchema})
    async answer(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Rfi.answer ` + String(_id) + `...`);
        const existing = await rfiService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "open";
        if (!["open"].includes(status)) {
            throw apiValidationException("invalid_status_for_answer", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "answered"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await rfiService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("rfis").readFields!, Rfi.schema);
            const updated = await rfiService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return rfiToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Rfi.answer done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: closeRfiFormSchema})
    async close(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Rfi.close ` + String(_id) + `...`);
        const existing = await rfiService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "open";
        if (!["answered", "open"].includes(status)) {
            throw apiValidationException("invalid_status_for_close", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "closed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await rfiService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("rfis").readFields!, Rfi.schema);
            const updated = await rfiService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return rfiToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Rfi.close done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: voidRfiFormSchema})
    async void(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Rfi.void ` + String(_id) + `...`);
        const existing = await rfiService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "open";
        if (!["open", "answered"].includes(status)) {
            throw apiValidationException("invalid_status_for_void", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "void"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await rfiService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("rfis").readFields!, Rfi.schema);
            const updated = await rfiService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return rfiToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Rfi.void done`);
        return undefined;
    }
}
