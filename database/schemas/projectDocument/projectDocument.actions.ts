import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {submitForReviewProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/submitForReviewProjectDocument.form.validator";
import {approveProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/approveProjectDocument.form.validator";
import {rejectProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/rejectProjectDocument.form.validator";
import {supersedeProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/supersedeProjectDocument.form.validator";
import {markAsBuiltProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/markAsBuiltProjectDocument.form.validator";
import type {ProjectDocument as ProjectDocumentData} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/projectDocument.dto";
import {projectDocumentToDTO} from "@propertyManagement/utilities/mappers/projectDocument/projectDocumentMapper.dto";
import ProjectDocument from "./projectDocument";
import {projectDocumentService} from "./projectDocument.service";

async function loadProjectDocumentForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return projectDocumentService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnProjectDocumentDto(projectDocumentId: any, params: Record<string, any>): Promise<ProjectDocumentData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("projectdocuments").readFields!, ProjectDocument.schema);
        const updated = await projectDocumentService.findById(projectDocumentId, {session, logger, languageCode}, populate.populate);
        if (updated) return projectDocumentToDTO(updated);
    } catch {
        logger.debug("User has no read permission on projectDocument after action");
    }
    return undefined;
}

function buildReceiverIds(existing: any, actionUserCtx: any): string[] {
    const createdById = existing.createdBy?._id?.toString() ?? existing.createdBy?.toString();
    return Array.from(new Set([
        String(actionUserCtx.userId),
        ...(createdById ? [createdById] : []),
    ]));
}

export class ProjectDocumentActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      submitForReviewProjectDocumentFormSchema,
    })
    async submitForReview(params: Record<string, any>): Promise<ProjectDocumentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Submitting projectDocument ${_id} for review...`);

        const existing = await loadProjectDocumentForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "draft" && status !== "rejected") {
            throw apiValidationException("invalid_status_for_submit_for_review", "", null, languageCode);
        }

        await projectDocumentService.updateByIdOrThrow(
            existing._id,
            {$set: {status: "for_review"}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnProjectDocumentDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.PROJECT_DOCUMENT_SUBMITTED_FOR_REVIEW, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: {
                companyId: company._id.toString(),
                projectDocumentId: existing._id.toString(),
                title: existing.title,
                projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
            },
        });

        logger.finish(`Submitted projectDocument ${_id} for review`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      approveProjectDocumentFormSchema,
    })
    async approve(params: Record<string, any>): Promise<ProjectDocumentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Approving projectDocument ${_id}...`);

        const existing = await loadProjectDocumentForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "for_review") {
            throw apiValidationException("invalid_status_for_approve", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "approved"}};
        const approvalNotes = notes !== undefined && notes !== null ? String(notes).trim() : "";
        if (approvalNotes) {
            const existingNotes = typeof existing.notes === "string" ? existing.notes.trim() : "";
            update.$set.notes = existingNotes ? `${existingNotes}\n-----\n${approvalNotes}` : approvalNotes;
        }

        await projectDocumentService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnProjectDocumentDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.PROJECT_DOCUMENT_APPROVED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: {
                companyId: company._id.toString(),
                projectDocumentId: existing._id.toString(),
                title: existing.title,
                projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
            },
        });

        logger.finish(`Approved projectDocument ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      rejectProjectDocumentFormSchema,
    })
    async reject(params: Record<string, any>): Promise<ProjectDocumentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Rejecting projectDocument ${_id}...`);

        const existing = await loadProjectDocumentForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "for_review") {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "rejected"}};
        const rejectionNotes = notes !== undefined && notes !== null ? String(notes).trim() : "";
        if (rejectionNotes) {
            const existingNotes = typeof existing.notes === "string" ? existing.notes.trim() : "";
            update.$set.notes = existingNotes ? `${existingNotes}\n-----\n${rejectionNotes}` : rejectionNotes;
        }

        await projectDocumentService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnProjectDocumentDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.PROJECT_DOCUMENT_REJECTED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: {
                companyId: company._id.toString(),
                projectDocumentId: existing._id.toString(),
                title: existing.title,
                projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
            },
        });

        logger.finish(`Rejected projectDocument ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      supersedeProjectDocumentFormSchema,
    })
    async supersede(params: Record<string, any>): Promise<ProjectDocumentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Superseding projectDocument ${_id}...`);

        const existing = await loadProjectDocumentForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "approved") {
            throw apiValidationException("invalid_status_for_supersede", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "superseded"}};
        const supersedeNotes = notes !== undefined && notes !== null ? String(notes).trim() : "";
        if (supersedeNotes) {
            const existingNotes = typeof existing.notes === "string" ? existing.notes.trim() : "";
            update.$set.notes = existingNotes ? `${existingNotes}\n-----\n${supersedeNotes}` : supersedeNotes;
        }

        await projectDocumentService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnProjectDocumentDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.PROJECT_DOCUMENT_SUPERSEDED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: {
                companyId: company._id.toString(),
                projectDocumentId: existing._id.toString(),
                title: existing.title,
                projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
            },
        });

        logger.finish(`Superseded projectDocument ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      markAsBuiltProjectDocumentFormSchema,
    })
    async markAsBuilt(params: Record<string, any>): Promise<ProjectDocumentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Marking projectDocument ${_id} as built...`);

        const existing = await loadProjectDocumentForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "approved") {
            throw apiValidationException("invalid_status_for_mark_as_built", "", null, languageCode);
        }

        await projectDocumentService.updateByIdOrThrow(
            existing._id,
            {$set: {isAsBuilt: true}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnProjectDocumentDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.PROJECT_DOCUMENT_MARKED_AS_BUILT, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: {
                companyId: company._id.toString(),
                projectDocumentId: existing._id.toString(),
                title: existing.title,
                projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
            },
        });

        logger.finish(`Marked projectDocument ${_id} as built`);
        return returnData;
    }
}
