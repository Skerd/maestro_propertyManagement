import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {startHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/startHandoverPackage.form.validator";
import {markReadyHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/markReadyHandoverPackage.form.validator";
import {completeHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/completeHandoverPackage.form.validator";
import HandoverPackage from "./handoverPackage";
import {handoverPackageService} from "./handoverPackage.service";
import {handoverPackageToDTO} from "@propertyManagement/utilities/mappers/handoverPackage/handoverPackageMapper.dto";

export class HandoverPackageActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: startHandoverPackageFormSchema})
    async start(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`HandoverPackage.start ` + String(_id) + `...`);
        const existing = await handoverPackageService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_start", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "in_progress"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await handoverPackageService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("handoverpackages").readFields!, HandoverPackage.schema);
            const updated = await handoverPackageService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return handoverPackageToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`HandoverPackage.start done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markReadyHandoverPackageFormSchema})
    async markReady(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`HandoverPackage.markReady ` + String(_id) + `...`);
        const existing = await handoverPackageService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["in_progress"].includes(status)) {
            throw apiValidationException("invalid_status_for_markReady", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "ready"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await handoverPackageService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("handoverpackages").readFields!, HandoverPackage.schema);
            const updated = await handoverPackageService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return handoverPackageToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`HandoverPackage.markReady done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: completeHandoverPackageFormSchema})
    async complete(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`HandoverPackage.complete ` + String(_id) + `...`);
        const existing = await handoverPackageService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["ready", "in_progress"].includes(status)) {
            throw apiValidationException("invalid_status_for_complete", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "completed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await handoverPackageService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("handoverpackages").readFields!, HandoverPackage.schema);
            const updated = await handoverPackageService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return handoverPackageToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`HandoverPackage.complete done`);
        return undefined;
    }
}
