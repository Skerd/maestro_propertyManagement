import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {startDueDiligenceLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/startDueDiligenceLandParcel.form.validator";
import {addDueDiligenceStepLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/addDueDiligenceStepLandParcel.form.validator";
import {concludeDueDiligenceLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/concludeDueDiligenceLandParcel.form.validator";
import {disposeLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/disposeLandParcel.form.validator";
import {LAND_PARCEL_DUE_DILIGENCE_STEP_MAX_FILES} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/landParcel.schema-def";
import LandParcel from "./landParcel";
import {landParcelService} from "./landParcel.service";
import {landParcelToDTO} from "@propertyManagement/utilities/mappers/landParcel/landParcelMapper.dto";
import {ClientSession} from "mongoose";
import {serverLogger} from "@coreModule/loggers/serverLog";

function trimmedOptional(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const next = String(value).trim();
    return next ? next : undefined;
}

function dueDiligenceStep(title: string, notes: string | undefined, userId: string, fileIds: unknown) {
    return {
        title,
        notes,
        performedBy: new ObjectId(userId),
        performedAt: new Date(),
        media: Array.isArray(fileIds) && fileIds.length > 0 ? fileIds.map((id: string) => new ObjectId(id)) : []
    };
}

async function landParcelAfterUpdate(existingId: ObjectId, session: ClientSession, logger: serverLogger, languageCode: string) {
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("landparcels").readFields!, LandParcel.schema);
        const updated = await landParcelService.findById(existingId, {session, logger, languageCode}, populate.populate);
        if (updated) return landParcelToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

export class LandParcelActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        middleware: [mediaUploadMW({maxFiles: LAND_PARCEL_DUE_DILIGENCE_STEP_MAX_FILES, maxFileSize: 50 * 1024 * 1024})],
        schema: startDueDiligenceLandParcelFormSchema,
    })
    async startDueDiligence(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, dueDiligenceStatus, dueDiligenceNotes, fileIds} = params;
        logger.start(`Starting due diligence for land parcel` + String(_id) + `...`);
        const existing = await landParcelService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});

        const status = existing.status ?? "prospect";
        if (!["prospect", "dd_failed"].includes(status)) {
            throw apiValidationException("invalid_status_for_startDueDiligence", "", null, languageCode);
        }

        const notes = trimmedOptional(dueDiligenceNotes);
        await landParcelService.updateByIdOrThrow(
            existing._id,
            {
                $set: {
                    status: "under_dd",
                    dueDiligenceStatus,
                    ...(!!notes ? {dueDiligenceNotes: notes} : {})
                },
                $push: {
                    dueDiligenceSteps: dueDiligenceStep(dueDiligenceStatus, notes, actionUserCtx.userId, fileIds)
                }
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        const dto = await landParcelAfterUpdate(existing._id, session, logger, languageCode);
        logger.finish(`Due Diligence started for land parcel!`);
        return dto;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        middleware: [mediaUploadMW({maxFiles: LAND_PARCEL_DUE_DILIGENCE_STEP_MAX_FILES, maxFileSize: 50 * 1024 * 1024})],
        schema: addDueDiligenceStepLandParcelFormSchema,
    })
    async addDueDiligenceStep(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, title, notes, fileIds} = params;
        logger.start(`Adding new due diligence step to land parcel ` + String(_id) + `...`);

        const existing = await landParcelService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        const status = existing.status ?? "prospect";
        if (status !== "under_dd") {
            throw apiValidationException("invalid_status_for_addDueDiligenceStep", "", null, languageCode);
        }

        const stepNotes = trimmedOptional(notes);
        await landParcelService.updateByIdOrThrow(
            existing._id,
            {
                $set: {
                    dueDiligenceStatus: title,
                    ...(!!stepNotes ? {dueDiligenceNotes: stepNotes} : {})
                },
                $push: {
                    dueDiligenceSteps: dueDiligenceStep(title, stepNotes, actionUserCtx.userId, fileIds)
                }
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        const dto = await landParcelAfterUpdate(existing._id, session, logger, languageCode);
        logger.finish('Finished adding new due diligence step to land parcel!');
        return dto;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        middleware: [mediaUploadMW({maxFiles: LAND_PARCEL_DUE_DILIGENCE_STEP_MAX_FILES, maxFileSize: 50 * 1024 * 1024})],
        schema: concludeDueDiligenceLandParcelFormSchema,
    })
    async concludeDueDiligence(params: Record<string, any>): Promise<any> {
        const {
            logger, languageCode, session, actionUserCtx, company, _id,
            outcome, cadastralReference, acquisitionNotes, dueDiligenceStatus, dueDiligenceNotes, fileIds,
        } = params;
        logger.start(`Concluding due diligence for land parcel ` + String(_id) + `...`);
        const existing = await landParcelService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode},);
        const status = existing.status ?? "prospect";
        if (status !== "under_dd") {
            throw apiValidationException("invalid_status_for_concludeDueDiligence", "", null, languageCode);
        }
        if (outcome === "approved") {
            const notes = trimmedOptional(acquisitionNotes);
            await landParcelService.updateByIdOrThrow(
                existing._id,
                {
                    $set: {
                        status: "acquired",
                        cadastralReference,
                        ...(!!notes ? {acquisitionNotes: notes} : {})
                    }
                },
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        } else {
            const declineNotes = trimmedOptional(dueDiligenceNotes);
            await landParcelService.updateByIdOrThrow(
                existing._id,
                {
                    $set: {
                        status: "dd_failed",
                        dueDiligenceStatus,
                        ...(!!declineNotes ? {dueDiligenceNotes: declineNotes} : {})
                    },
                    $push: {
                        dueDiligenceSteps: dueDiligenceStep(dueDiligenceStatus, declineNotes, actionUserCtx.userId, fileIds)
                    }
                },
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }
        const dto = await landParcelAfterUpdate(existing._id, session, logger, languageCode);
        logger.finish(`Finished concluding due diligence for land parcel!`);
        return dto;
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: disposeLandParcelFormSchema})
    async dispose(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, disposeNotes} = params;
        logger.start(`Disposing of land parcel ` + String(_id) + `...`);
        const existing = await landParcelService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode},);
        const status = existing.status ?? "prospect";
        if (!["acquired", "dd_failed"].includes(status)) {
            throw apiValidationException("invalid_status_for_dispose", "", null, languageCode);
        }
        const notes = trimmedOptional(disposeNotes);
        await landParcelService.updateByIdOrThrow(
            existing._id,
            {
                $set: {
                    status: "disposed",
                    ...(!!notes ? {disposeNotes: notes} : {})
                }
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        const dto = await landParcelAfterUpdate(existing._id, session, logger, languageCode);
        logger.finish(`Finished disposing of land parcel!`);
        return dto;
    }
}
