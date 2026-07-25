import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {startMilestoneFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/startMilestone.form.validator";
import {completeMilestoneFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/completeMilestone.form.validator";
import {markDelayedMilestoneFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/markDelayedMilestone.form.validator";
import {cancelMilestoneFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/cancelMilestone.form.validator";
import type {Milestone as MilestoneData} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/milestone.dto";
import {milestoneToDTO} from "@propertyManagement/utilities/mappers/milestone/milestoneMapper.dto";
import Milestone from "./milestone";
import {milestoneService} from "./milestone.service";

async function loadMilestoneForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return milestoneService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnMilestoneDto(milestoneId: any, params: Record<string, any>): Promise<MilestoneData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("milestones").readFields!, Milestone.schema);
        const updated = await milestoneService.findById(milestoneId, {session, logger, languageCode}, populate.populate);
        if (updated) return milestoneToDTO(updated);
    } catch {
        logger.debug("User has no read permission on milestone after action");
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

function appendNotes(existing: any, incoming: unknown): string | undefined {
    const trimmed = incoming !== undefined && incoming !== null ? String(incoming).trim() : "";
    if (!trimmed) return undefined;
    const existingNotes = typeof existing.notes === "string" ? existing.notes.trim() : "";
    return existingNotes ? `${existingNotes}\n-----\n${trimmed}` : trimmed;
}

function milestonePayload(existing: any, company: any) {
    return {
        companyId: company._id.toString(),
        milestoneId: existing._id.toString(),
        title: existing.title,
        projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
    };
}

export class MilestoneActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      startMilestoneFormSchema,
    })
    async start(params: Record<string, any>): Promise<MilestoneData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Starting milestone ${_id}...`);

        const existing = await loadMilestoneForAction(params);
        const status = existing.status ?? "planned";

        if (status !== "planned") {
            throw apiValidationException("invalid_status_for_start", "", null, languageCode);
        }

        await milestoneService.updateByIdOrThrow(
            existing._id,
            {$set: {status: "in_progress", actualStart: new Date()}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnMilestoneDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.MILESTONE_STARTED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: milestonePayload(existing, company),
        });

        logger.finish(`Started milestone ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      completeMilestoneFormSchema,
    })
    async complete(params: Record<string, any>): Promise<MilestoneData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Completing milestone ${_id}...`);

        const existing = await loadMilestoneForAction(params);
        const status = existing.status ?? "planned";

        if (status !== "in_progress" && status !== "delayed") {
            throw apiValidationException("invalid_status_for_complete", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "completed", actualEnd: new Date()}};
        const merged = appendNotes(existing, notes);
        if (merged) update.$set.notes = merged;

        await milestoneService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnMilestoneDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.MILESTONE_COMPLETED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: milestonePayload(existing, company),
        });

        logger.finish(`Completed milestone ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      markDelayedMilestoneFormSchema,
    })
    async markDelayed(params: Record<string, any>): Promise<MilestoneData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Marking milestone ${_id} as delayed...`);

        const existing = await loadMilestoneForAction(params);
        const status = existing.status ?? "planned";

        if (status !== "planned" && status !== "in_progress") {
            throw apiValidationException("invalid_status_for_mark_delayed", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "delayed"}};
        const merged = appendNotes(existing, notes);
        if (merged) update.$set.notes = merged;

        await milestoneService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnMilestoneDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.MILESTONE_SLIPPING, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: milestonePayload(existing, company),
        });

        logger.finish(`Marked milestone ${_id} as delayed`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      cancelMilestoneFormSchema,
    })
    async cancel(params: Record<string, any>): Promise<MilestoneData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, notes} = params;

        logger.start(`Cancelling milestone ${_id}...`);

        const existing = await loadMilestoneForAction(params);
        const status = existing.status ?? "planned";

        if (status === "completed" || status === "cancelled") {
            throw apiValidationException("invalid_status_for_cancel", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "cancelled"}};
        const merged = appendNotes(existing, notes);
        if (merged) update.$set.notes = merged;

        await milestoneService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnMilestoneDto(existing._id, params);
        logger.finish(`Cancelled milestone ${_id}`);
        return returnData;
    }
}
