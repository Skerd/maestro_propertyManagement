import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitForReviewFeasibilityStudyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/submitForReviewFeasibilityStudy.form.validator";
import {approveFeasibilityStudyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/approveFeasibilityStudy.form.validator";
import {rejectFeasibilityStudyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/rejectFeasibilityStudy.form.validator";
import {archiveFeasibilityStudyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/archiveFeasibilityStudy.form.validator";
import FeasibilityStudy from "./feasibilityStudy";
import {feasibilityStudyService} from "./feasibilityStudy.service";
import {feasibilityStudyToDTO} from "@propertyManagement/utilities/mappers/feasibilityStudy/feasibilityStudyMapper.dto";

export class FeasibilityStudyActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: submitForReviewFeasibilityStudyFormSchema})
    async submitForReview(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`FeasibilityStudy.submitForReview ` + String(_id) + `...`);
        const existing = await feasibilityStudyService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_submitForReview", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "in_review"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await feasibilityStudyService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("feasibilitystudies").readFields!, FeasibilityStudy.schema);
            const updated = await feasibilityStudyService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return feasibilityStudyToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`FeasibilityStudy.submitForReview done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveFeasibilityStudyFormSchema})
    async approve(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`FeasibilityStudy.approve ` + String(_id) + `...`);
        const existing = await feasibilityStudyService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["in_review"].includes(status)) {
            throw apiValidationException("invalid_status_for_approve", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "approved"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await feasibilityStudyService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("feasibilitystudies").readFields!, FeasibilityStudy.schema);
            const updated = await feasibilityStudyService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return feasibilityStudyToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`FeasibilityStudy.approve done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectFeasibilityStudyFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`FeasibilityStudy.reject ` + String(_id) + `...`);
        const existing = await feasibilityStudyService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["in_review"].includes(status)) {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "rejected"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await feasibilityStudyService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("feasibilitystudies").readFields!, FeasibilityStudy.schema);
            const updated = await feasibilityStudyService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return feasibilityStudyToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`FeasibilityStudy.reject done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: archiveFeasibilityStudyFormSchema})
    async archive(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`FeasibilityStudy.archive ` + String(_id) + `...`);
        const existing = await feasibilityStudyService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["approved", "rejected", "draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_archive", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "archived"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await feasibilityStudyService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("feasibilitystudies").readFields!, FeasibilityStudy.schema);
            const updated = await feasibilityStudyService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return feasibilityStudyToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`FeasibilityStudy.archive done`);
        return undefined;
    }
}
