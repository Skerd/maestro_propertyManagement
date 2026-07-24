import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {activateConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/activateConstructionContract.form.validator";
import {suspendConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/suspendConstructionContract.form.validator";
import {resumeConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/resumeConstructionContract.form.validator";
import {completeConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/completeConstructionContract.form.validator";
import {terminateConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/terminateConstructionContract.form.validator";
import ConstructionContract from "./constructionContract";
import {constructionContractService} from "./constructionContract.service";
import {constructionContractToDTO} from "@propertyManagement/utilities/mappers/constructionContract/constructionContractMapper.dto";

export class ConstructionContractActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: activateConstructionContractFormSchema})
    async activate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConstructionContract.activate ` + String(_id) + `...`);
        const existing = await constructionContractService.findOneOrThrow(
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
        await constructionContractService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("constructioncontracts").readFields!, ConstructionContract.schema);
            const updated = await constructionContractService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return constructionContractToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConstructionContract.activate done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: suspendConstructionContractFormSchema})
    async suspend(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConstructionContract.suspend ` + String(_id) + `...`);
        const existing = await constructionContractService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["active"].includes(status)) {
            throw apiValidationException("invalid_status_for_suspend", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "suspended"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await constructionContractService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("constructioncontracts").readFields!, ConstructionContract.schema);
            const updated = await constructionContractService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return constructionContractToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConstructionContract.suspend done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: resumeConstructionContractFormSchema})
    async resume(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConstructionContract.resume ` + String(_id) + `...`);
        const existing = await constructionContractService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["suspended"].includes(status)) {
            throw apiValidationException("invalid_status_for_resume", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "active"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await constructionContractService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("constructioncontracts").readFields!, ConstructionContract.schema);
            const updated = await constructionContractService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return constructionContractToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConstructionContract.resume done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: completeConstructionContractFormSchema})
    async complete(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConstructionContract.complete ` + String(_id) + `...`);
        const existing = await constructionContractService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["active", "suspended"].includes(status)) {
            throw apiValidationException("invalid_status_for_complete", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "completed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await constructionContractService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("constructioncontracts").readFields!, ConstructionContract.schema);
            const updated = await constructionContractService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return constructionContractToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConstructionContract.complete done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: terminateConstructionContractFormSchema})
    async terminate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`ConstructionContract.terminate ` + String(_id) + `...`);
        const existing = await constructionContractService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft", "active", "suspended"].includes(status)) {
            throw apiValidationException("invalid_status_for_terminate", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "terminated"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await constructionContractService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("constructioncontracts").readFields!, ConstructionContract.schema);
            const updated = await constructionContractService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return constructionContractToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`ConstructionContract.terminate done`);
        return undefined;
    }
}
