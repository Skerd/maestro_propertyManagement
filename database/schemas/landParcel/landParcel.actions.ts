import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {startDueDiligenceLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/startDueDiligenceLandParcel.form.validator";
import {markAcquiredLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/markAcquiredLandParcel.form.validator";
import {disposeLandParcelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/disposeLandParcel.form.validator";
import LandParcel from "./landParcel";
import {landParcelService} from "./landParcel.service";
import {landParcelToDTO} from "@propertyManagement/utilities/mappers/landParcel/landParcelMapper.dto";

export class LandParcelActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: startDueDiligenceLandParcelFormSchema})
    async startDueDiligence(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`LandParcel.startDueDiligence ` + String(_id) + `...`);
        const existing = await landParcelService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "prospect";
        if (!["prospect"].includes(status)) {
            throw apiValidationException("invalid_status_for_startDueDiligence", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "under_dd"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await landParcelService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("landparcels").readFields!, LandParcel.schema);
            const updated = await landParcelService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return landParcelToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`LandParcel.startDueDiligence done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markAcquiredLandParcelFormSchema})
    async markAcquired(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`LandParcel.markAcquired ` + String(_id) + `...`);
        const existing = await landParcelService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "prospect";
        if (!["under_dd", "prospect"].includes(status)) {
            throw apiValidationException("invalid_status_for_markAcquired", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "acquired"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await landParcelService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("landparcels").readFields!, LandParcel.schema);
            const updated = await landParcelService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return landParcelToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`LandParcel.markAcquired done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: disposeLandParcelFormSchema})
    async dispose(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`LandParcel.dispose ` + String(_id) + `...`);
        const existing = await landParcelService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "prospect";
        if (!["acquired"].includes(status)) {
            throw apiValidationException("invalid_status_for_dispose", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "disposed"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await landParcelService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("landparcels").readFields!, LandParcel.schema);
            const updated = await landParcelService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return landParcelToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`LandParcel.dispose done`);
        return undefined;
    }
}
