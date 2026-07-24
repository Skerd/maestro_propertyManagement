import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {passCommissioningRecordFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commissioningRecord/passCommissioningRecord.form.validator";
import {failCommissioningRecordFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commissioningRecord/failCommissioningRecord.form.validator";
import CommissioningRecord from "./commissioningRecord";
import {commissioningRecordService} from "./commissioningRecord.service";
import {commissioningRecordToDTO} from "@propertyManagement/utilities/mappers/commissioningRecord/commissioningRecordMapper.dto";

export class CommissioningRecordActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: passCommissioningRecordFormSchema})
    async pass(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`CommissioningRecord.pass ` + String(_id) + `...`);
        const existing = await commissioningRecordService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending";
        if (!["pending", "failed"].includes(status)) {
            throw apiValidationException("invalid_status_for_pass", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "passed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await commissioningRecordService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("commissioningrecords").readFields!, CommissioningRecord.schema);
            const updated = await commissioningRecordService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return commissioningRecordToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CommissioningRecord.pass done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: failCommissioningRecordFormSchema})
    async fail(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`CommissioningRecord.fail ` + String(_id) + `...`);
        const existing = await commissioningRecordService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "pending";
        if (!["pending", "passed"].includes(status)) {
            throw apiValidationException("invalid_status_for_fail", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "failed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await commissioningRecordService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("commissioningrecords").readFields!, CommissioningRecord.schema);
            const updated = await commissioningRecordService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return commissioningRecordToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CommissioningRecord.fail done`);
        return undefined;
    }
}
