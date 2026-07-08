import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {assignSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/assignSnag.form.validator";
import {startWorkingSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/startWorkingSnag.form.validator";
import {finishWorkingSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/finishWorkingSnag.form.validator";
import type {Snag as SnagData} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.dto";
import {snagToDTO} from "@propertyManagement/utilities/mappers/snag/snagMapper.dto";
import Snag from "./snag";
import {snagService} from "./snag.service";

async function loadSnagForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return snagService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnSnagDto(snagId: any, params: Record<string, any>): Promise<SnagData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("snags").readFields!, Snag.schema);
        const updated = await snagService.findById(snagId, {session, logger, languageCode}, populate.populate);
        if (updated) return snagToDTO(updated);
    } catch {
        logger.debug("User has no read permission on snag after action");
    }
    return undefined;
}

export class SnagActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      assignSnagFormSchema,
    })
    async assign(params: Record<string, any>): Promise<SnagData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, assignedTo} = params;

        logger.start(`Assigning snag ${_id}...`);

        const existing = await loadSnagForAction(params);
        const status = existing.status ?? "open";

        if (status !== "open" && status !== "in_progress") {
            throw apiValidationException("invalid_status_for_assign", "", null, languageCode);
        }

        await snagService.updateByIdOrThrow(
            existing._id,
            {$set: {assignedTo: new ObjectId(assignedTo)}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnSnagDto(existing._id, params);
        logger.finish(`Assigned snag ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      startWorkingSnagFormSchema,
    })
    async startWorking(params: Record<string, any>): Promise<SnagData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id} = params;

        logger.start(`Starting work on snag ${_id}...`);

        const existing = await loadSnagForAction(params);
        const status = existing.status ?? "open";
        const assigneeId = (existing.assignedTo as any)?._id ?? existing.assignedTo;

        if (status !== "open") {
            throw apiValidationException("invalid_status_for_start_working", "", null, languageCode);
        }
        if (!assigneeId) {
            throw apiValidationException("snag_not_assigned", "", null, languageCode);
        }

        await snagService.updateByIdOrThrow(
            existing._id,
            {$set: {status: "in_progress"}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnSnagDto(existing._id, params);
        logger.finish(`Started work on snag ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        middleware:  [mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024})],
        schema:      finishWorkingSnagFormSchema,
    })
    async finishWorking(params: Record<string, any>): Promise<SnagData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, notes, fileIds} = params;

        logger.start(`Finishing work on snag ${_id}...`);

        const existing = await loadSnagForAction(params);
        const status = existing.status ?? "open";

        if (status !== "in_progress") {
            throw apiValidationException("invalid_status_for_finish_working", "", null, languageCode);
        }

        const update: Record<string, any> = {
            $set: {
                status: "resolved",
                resolvedAt: new Date(),
            },
        };

        const completionNotes = notes !== undefined && notes !== null ? String(notes).trim() : "";
        if (completionNotes) {
            const existingNotes = typeof existing.notes === "string" ? existing.notes.trim() : "";
            update.$set.notes = existingNotes
                ? `${existingNotes}\n-----\n${completionNotes}`
                : completionNotes;
        }

        if (Array.isArray(fileIds) && fileIds.length > 0) {
            update.$push = {
                photos: {$each: fileIds.map((id: string) => new ObjectId(id))},
            };
        }

        await snagService.updateByIdOrThrow(
            existing._id,
            update,
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnSnagDto(existing._id, params);
        logger.finish(`Finished work on snag ${_id}`);
        return returnData;
    }
}
