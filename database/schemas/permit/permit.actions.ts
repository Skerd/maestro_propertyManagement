import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitPermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/submitPermit.form.validator";
import {markUnderReviewPermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/markUnderReviewPermit.form.validator";
import {approvePermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/approvePermit.form.validator";
import {rejectPermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/rejectPermit.form.validator";
import {renewPermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/renewPermit.form.validator";
import type {Permit as PermitData} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/permit.dto";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {permitToDTO} from "@propertyManagement/utilities/mappers/permit/permitMapper.dto";
import Permit from "./permit";
import {permitService} from "./permit.service";

async function loadPermitForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return permitService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnPermitDto(permitId: any, params: Record<string, any>): Promise<PermitData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("permits").readFields!, Permit.schema);
        const updated = await permitService.findById(permitId, {session, logger, languageCode}, populate.populate);
        if (updated) return permitToDTO(updated);
    } catch {
        logger.debug("User has no read permission on permit after action");
    }
    return undefined;
}

function appendNotes(existingNotes: unknown, addition: unknown): string | undefined {
    const trimmedAddition = addition !== undefined && addition !== null ? String(addition).trim() : "";
    if (!trimmedAddition) return typeof existingNotes === "string" ? existingNotes : undefined;
    const trimmedExisting = typeof existingNotes === "string" ? existingNotes.trim() : "";
    return trimmedExisting ? `${trimmedExisting}\n-----\n${trimmedAddition}` : trimmedAddition;
}

function notifyReceiverIds(existing: any): string[] {
    const createdById = (existing.createdBy as any)?._id?.toString() ?? existing.createdBy?.toString();
    return createdById ? [createdById] : [];
}

export class PermitActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      submitPermitFormSchema,
    })
    async submit(params: Record<string, any>): Promise<PermitData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Submitting permit ${_id}...`);

        const existing = await loadPermitForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "draft") {
            throw apiValidationException("invalid_status_for_submit", "", null, languageCode);
        }

        await permitService.updateByIdOrThrow(
            existing._id,
            {$set: {status: "submitted", submittedAt: new Date()}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPermitDto(existing._id, params);

        const receiverIds = notifyReceiverIds(existing);
        if (receiverIds.length) {
            emitNotificationEvent(NotificationEventCodes.PERMIT_SUBMITTED, {
                receiverIds,
                payload: {
                    companyId: company._id.toString(),
                    permitId: existing._id.toString(),
                    title: existing.title,
                    projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Submitted permit ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      markUnderReviewPermitFormSchema,
    })
    async markUnderReview(params: Record<string, any>): Promise<PermitData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Marking permit ${_id} as under review...`);

        const existing = await loadPermitForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "submitted") {
            throw apiValidationException("invalid_status_for_mark_under_review", "", null, languageCode);
        }

        await permitService.updateByIdOrThrow(
            existing._id,
            {$set: {status: "under_review"}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPermitDto(existing._id, params);

        const receiverIds = notifyReceiverIds(existing);
        if (receiverIds.length) {
            emitNotificationEvent(NotificationEventCodes.PERMIT_UNDER_REVIEW, {
                receiverIds,
                payload: {
                    companyId: company._id.toString(),
                    permitId: existing._id.toString(),
                    title: existing.title,
                    projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Marked permit ${_id} as under review`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      approvePermitFormSchema,
    })
    async approve(params: Record<string, any>): Promise<PermitData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes, expiresAt} = params;

        logger.start(`Approving permit ${_id}...`);

        const existing = await loadPermitForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "submitted" && status !== "under_review") {
            throw apiValidationException("invalid_status_for_approve", "", null, languageCode);
        }

        const update: Record<string, any> = {
            $set: {
                status: "approved",
                approvedAt: new Date(),
            },
        };

        if (expiresAt) update.$set.expiresAt = new Date(expiresAt);

        const mergedNotes = appendNotes(existing.notes, notes);
        if (mergedNotes !== undefined) update.$set.notes = mergedNotes;

        await permitService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPermitDto(existing._id, params);

        const receiverIds = notifyReceiverIds(existing);
        if (receiverIds.length) {
            emitNotificationEvent(NotificationEventCodes.PERMIT_APPROVED, {
                receiverIds,
                payload: {
                    companyId: company._id.toString(),
                    permitId: existing._id.toString(),
                    title: existing.title,
                    projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
                    expiresAt: update.$set.expiresAt ? update.$set.expiresAt.toISOString() : undefined,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Approved permit ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      rejectPermitFormSchema,
    })
    async reject(params: Record<string, any>): Promise<PermitData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Rejecting permit ${_id}...`);

        const existing = await loadPermitForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "submitted" && status !== "under_review") {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "rejected"}};
        const mergedNotes = appendNotes(existing.notes, notes);
        if (mergedNotes !== undefined) update.$set.notes = mergedNotes;

        await permitService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPermitDto(existing._id, params);

        const receiverIds = notifyReceiverIds(existing);
        if (receiverIds.length) {
            emitNotificationEvent(NotificationEventCodes.PERMIT_REJECTED, {
                receiverIds,
                payload: {
                    companyId: company._id.toString(),
                    permitId: existing._id.toString(),
                    title: existing.title,
                    projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
                    notes,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Rejected permit ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      renewPermitFormSchema,
    })
    async renew(params: Record<string, any>): Promise<PermitData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes, expiresAt} = params;

        logger.start(`Renewing permit ${_id}...`);

        const existing = await loadPermitForAction(params);
        const status = existing.status ?? "draft";

        if (status !== "approved" && status !== "expired") {
            throw apiValidationException("invalid_status_for_renew", "", null, languageCode);
        }

        const update: Record<string, any> = {
            $set: {
                status: "approved",
                expiresAt: new Date(expiresAt),
                renewedAt: new Date(),
            },
            $unset: {
                expiryReminderSentAt30d: "",
                expiryReminderSentAt7d: "",
                expiryReminderSentAt3d: "",
                expiryReminderSentAt0d: "",
            },
        };

        const mergedNotes = appendNotes(existing.notes, notes);
        if (mergedNotes !== undefined) update.$set.notes = mergedNotes;

        await permitService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPermitDto(existing._id, params);

        const receiverIds = notifyReceiverIds(existing);
        if (receiverIds.length) {
            emitNotificationEvent(NotificationEventCodes.PERMIT_RENEWED, {
                receiverIds,
                payload: {
                    companyId: company._id.toString(),
                    permitId: existing._id.toString(),
                    title: existing.title,
                    projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
                    expiresAt: update.$set.expiresAt.toISOString(),
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Renewed permit ${_id}`);
        return returnData;
    }
}
