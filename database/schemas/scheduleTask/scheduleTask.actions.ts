import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {startScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/startScheduleTask.form.validator";
import {completeScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/completeScheduleTask.form.validator";
import {updateProgressScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/updateProgressScheduleTask.form.validator";
import {markDelayedScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/markDelayedScheduleTask.form.validator";
import {cancelScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/cancelScheduleTask.form.validator";
import type {ScheduleTask as ScheduleTaskData} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/scheduleTask.dto";
import {scheduleTaskToDTO} from "@propertyManagement/utilities/mappers/scheduleTask/scheduleTaskMapper.dto";
import ScheduleTask from "./scheduleTask";
import {scheduleTaskService} from "./scheduleTask.service";

async function loadScheduleTaskForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return scheduleTaskService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnScheduleTaskDto(scheduleTaskId: any, params: Record<string, any>): Promise<ScheduleTaskData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("scheduletasks").readFields!, ScheduleTask.schema);
        const updated = await scheduleTaskService.findById(scheduleTaskId, {session, logger, languageCode}, populate.populate);
        if (updated) return scheduleTaskToDTO(updated);
    } catch {
        logger.debug("User has no read permission on scheduleTask after action");
    }
    return undefined;
}

function buildReceiverIds(existing: any, actionUserCtx: any): string[] {
    const createdById = existing.createdBy?._id?.toString() ?? existing.createdBy?.toString();
    const assigneeId = (existing.assignee as any)?._id?.toString() ?? existing.assignee?.toString();
    return Array.from(new Set([
        String(actionUserCtx.userId),
        ...(createdById ? [createdById] : []),
        ...(assigneeId ? [assigneeId] : []),
    ]));
}

function appendNotes(existing: any, incoming: unknown): string | undefined {
    const trimmed = incoming !== undefined && incoming !== null ? String(incoming).trim() : "";
    if (!trimmed) return undefined;
    const existingNotes = typeof existing.notes === "string" ? existing.notes.trim() : "";
    return existingNotes ? `${existingNotes}\n-----\n${trimmed}` : trimmed;
}

function scheduleTaskPayload(existing: any, company: any) {
    return {
        companyId: company._id.toString(),
        scheduleTaskId: existing._id.toString(),
        title: existing.title,
        projectId: (existing.project as any)?._id?.toString() ?? existing.project?.toString(),
        milestoneId: (existing.milestone as any)?._id?.toString() ?? existing.milestone?.toString(),
    };
}

export class ScheduleTaskActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      startScheduleTaskFormSchema,
    })
    async start(params: Record<string, any>): Promise<ScheduleTaskData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Starting scheduleTask ${_id}...`);

        const existing = await loadScheduleTaskForAction(params);
        const status = existing.status ?? "planned";

        if (status !== "planned") {
            throw apiValidationException("invalid_status_for_start", "", null, languageCode);
        }

        await scheduleTaskService.updateByIdOrThrow(
            existing._id,
            {$set: {status: "in_progress", actualStart: new Date()}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnScheduleTaskDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.SCHEDULE_TASK_STARTED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: scheduleTaskPayload(existing, company),
        });

        logger.finish(`Started scheduleTask ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      completeScheduleTaskFormSchema,
    })
    async complete(params: Record<string, any>): Promise<ScheduleTaskData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;

        logger.start(`Completing scheduleTask ${_id}...`);

        const existing = await loadScheduleTaskForAction(params);
        const status = existing.status ?? "planned";

        if (status !== "in_progress" && status !== "delayed") {
            throw apiValidationException("invalid_status_for_complete", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "completed", actualEnd: new Date(), percentComplete: 100}};
        const merged = appendNotes(existing, notes);
        if (merged) update.$set.notes = merged;

        await scheduleTaskService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnScheduleTaskDto(existing._id, params);

        emitNotificationEvent(NotificationEventCodes.SCHEDULE_TASK_COMPLETED, {
            receiverIds: buildReceiverIds(existing, actionUserCtx),
            payload: scheduleTaskPayload(existing, company),
        });

        logger.finish(`Completed scheduleTask ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 60},
        transaction: true,
        schema:      updateProgressScheduleTaskFormSchema,
    })
    async updateProgress(params: Record<string, any>): Promise<ScheduleTaskData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, percentComplete} = params;

        logger.start(`Updating scheduleTask ${_id} progress...`);

        const existing = await loadScheduleTaskForAction(params);
        const status = existing.status ?? "planned";

        if (status === "completed" || status === "cancelled") {
            throw apiValidationException("invalid_status_for_update_progress", "", null, languageCode);
        }

        await scheduleTaskService.updateByIdOrThrow(
            existing._id,
            {$set: {percentComplete: Number(percentComplete)}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnScheduleTaskDto(existing._id, params);
        logger.finish(`Updated scheduleTask ${_id} progress`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      markDelayedScheduleTaskFormSchema,
    })
    async markDelayed(params: Record<string, any>): Promise<ScheduleTaskData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, notes} = params;

        logger.start(`Marking scheduleTask ${_id} as delayed...`);

        const existing = await loadScheduleTaskForAction(params);
        const status = existing.status ?? "planned";

        if (status !== "planned" && status !== "in_progress") {
            throw apiValidationException("invalid_status_for_mark_delayed", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "delayed"}};
        const merged = appendNotes(existing, notes);
        if (merged) update.$set.notes = merged;

        await scheduleTaskService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnScheduleTaskDto(existing._id, params);
        logger.finish(`Marked scheduleTask ${_id} as delayed`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      cancelScheduleTaskFormSchema,
    })
    async cancel(params: Record<string, any>): Promise<ScheduleTaskData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, notes} = params;

        logger.start(`Cancelling scheduleTask ${_id}...`);

        const existing = await loadScheduleTaskForAction(params);
        const status = existing.status ?? "planned";

        if (status === "completed" || status === "cancelled") {
            throw apiValidationException("invalid_status_for_cancel", "", null, languageCode);
        }

        const update: Record<string, any> = {$set: {status: "cancelled"}};
        const merged = appendNotes(existing, notes);
        if (merged) update.$set.notes = merged;

        await scheduleTaskService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnScheduleTaskDto(existing._id, params);
        logger.finish(`Cancelled scheduleTask ${_id}`);
        return returnData;
    }
}
