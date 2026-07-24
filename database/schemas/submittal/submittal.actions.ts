import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitSubmittalFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/submittal/submitSubmittal.form.validator";
import {requestRevisionSubmittalFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/submittal/requestRevisionSubmittal.form.validator";
import {approveSubmittalFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/submittal/approveSubmittal.form.validator";
import {rejectSubmittalFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/submittal/rejectSubmittal.form.validator";
import Submittal from "./submittal";
import {submittalService} from "./submittal.service";
import {submittalToDTO} from "@propertyManagement/utilities/mappers/submittal/submittalMapper.dto";

export class SubmittalActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: submitSubmittalFormSchema})
    async submit(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Submittal.submit ` + String(_id) + `...`);
        const existing = await submittalService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft", "revise_and_resubmit"].includes(status)) {
            throw apiValidationException("invalid_status_for_submit", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "submitted"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await submittalService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("submittals").readFields!, Submittal.schema);
            const updated = await submittalService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return submittalToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Submittal.submit done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: requestRevisionSubmittalFormSchema})
    async requestRevision(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Submittal.requestRevision ` + String(_id) + `...`);
        const existing = await submittalService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["submitted"].includes(status)) {
            throw apiValidationException("invalid_status_for_requestRevision", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "revise_and_resubmit"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await submittalService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("submittals").readFields!, Submittal.schema);
            const updated = await submittalService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return submittalToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Submittal.requestRevision done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveSubmittalFormSchema})
    async approve(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Submittal.approve ` + String(_id) + `...`);
        const existing = await submittalService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["submitted"].includes(status)) {
            throw apiValidationException("invalid_status_for_approve", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "approved"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await submittalService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("submittals").readFields!, Submittal.schema);
            const updated = await submittalService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return submittalToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Submittal.approve done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectSubmittalFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Submittal.reject ` + String(_id) + `...`);
        const existing = await submittalService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["submitted"].includes(status)) {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "rejected"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await submittalService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("submittals").readFields!, Submittal.schema);
            const updated = await submittalService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return submittalToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Submittal.reject done`);
        return undefined;
    }
}
