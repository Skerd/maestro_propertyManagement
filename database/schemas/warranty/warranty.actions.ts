import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {expireWarrantyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/expireWarranty.form.validator";
import {voidWarrantyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/voidWarranty.form.validator";
import Warranty from "./warranty";
import {warrantyService} from "./warranty.service";
import {warrantyToDTO} from "@propertyManagement/utilities/mappers/warranty/warrantyMapper.dto";

export class WarrantyActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: expireWarrantyFormSchema})
    async expire(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Warranty.expire ` + String(_id) + `...`);
        const existing = await warrantyService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "active";
        if (!["active"].includes(status)) {
            throw apiValidationException("invalid_status_for_expire", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "expired"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await warrantyService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("warranties").readFields!, Warranty.schema);
            const updated = await warrantyService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return warrantyToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Warranty.expire done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: voidWarrantyFormSchema})
    async void(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Warranty.void ` + String(_id) + `...`);
        const existing = await warrantyService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "active";
        if (!["active"].includes(status)) {
            throw apiValidationException("invalid_status_for_void", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "void"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await warrantyService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("warranties").readFields!, Warranty.schema);
            const updated = await warrantyService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return warrantyToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Warranty.void done`);
        return undefined;
    }
}
