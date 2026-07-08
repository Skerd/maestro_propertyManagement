import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {InspectionSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.schema-def";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {userService} from "@coreModule/database/schemas/user/user.service";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {inspectionService} from "../../../../database/schemas/inspection/inspection.service";
import {unitService} from "../../../../database/schemas/unit/unit.service";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import Inspection, {InspectionStatus} from "../../../../database/schemas/inspection/inspection";
import {generateZodCreateInspectionFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/createInspection.form.validator";
import {editInspectionFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/editInspection.form.validator";
import {inspectionsToDTO, inspectionToDTO} from "../../../../utilities/mappers/inspection/inspectionMapper.dto";
import {inspectionsToSelect} from "../../../../utilities/mappers/inspection/inspectionMapper.select";
import {validateInspectionSelectForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.select.form.validator";
import {inspectionFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.form.validator";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {SelectResponse} from "armonia/src/modules/core/types/shared.types";
import {InspectionActions} from "../../../../database/schemas/inspection/inspection.actions";

export const basePath = "/api/realEstate/unit/inspection";

const mediaUpload = mediaUploadMW({
    fields: {media: 20, clientSignatureMediaId: 1},
    maxFileSize: 100 * 1024 * 1024,
});

const FINDINGS_KEYS = [
    "structuralIssues", "electricalIssues", "plumbingIssues", "hvacIssues",
    "safetyConcerns", "cosmeticIssues", "otherObservations",
] as const;

function parseFindings(findings: unknown): Record<string, unknown[]> | undefined {
    if (!findings) return undefined;
    let parsed: unknown = findings;
    if (typeof findings === "string") {
        try {
            parsed = JSON.parse(findings);
        } catch {
            return undefined;
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown[]>;
}

function cleanFindings(
    parsed: Record<string, unknown[]> | undefined,
): Record<string, {notes: string; media: ObjectId[]; severity?: string; resolvedAt?: Date; resolvedBy?: ObjectId}[]> | undefined {
    if (!parsed) return undefined;
    const result: Record<string, {notes: string; media: ObjectId[]; severity?: string; resolvedAt?: Date; resolvedBy?: ObjectId}[]> = {};
    for (const key of FINDINGS_KEYS) {
        const items = parsed[key];
        if (!Array.isArray(items) || items.length === 0) continue;
        result[key] = items.filter((item: any) => String(item.notes ?? "").trim().length > 0).map((item: any) => {
            const resolvedByRaw = item.resolvedBy;
            const resolvedByIdStr = resolvedByRaw
                ? ((resolvedByRaw as any)?._id?.toString() ?? String(resolvedByRaw))
                : undefined;
            const media: ObjectId[] = Array.isArray(item.media)
                ? item.media.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id))
                : [];
            return {
                notes:      String(item.notes ?? "").trim(),
                media,
                severity:   item.severity ?? undefined,
                resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : undefined,
                resolvedBy: resolvedByIdStr && ObjectId.isValid(resolvedByIdStr) ? new ObjectId(resolvedByIdStr) : undefined,
            };
        });
    }
    return Object.keys(result).length > 0 ? result : undefined;
}


export const {router} = createCrudRouter({
    collectionName: "inspections",
    model: Inspection,
    service: inspectionService,
    createSchema: generateZodCreateInspectionFormSchema,
    editSchema: editInspectionFormSchema,
    listSchema: inspectionFormSchema,
    selectSchema: validateInspectionSelectForm,
    toDTO: inspectionToDTO,
    toDTOArray: inspectionsToDTO,
    toSelect: inspectionsToSelect,
    defaultSort: {inspectionDate: -1},
    selectSort: {inspectionDate: -1},
    createMiddleware: [mediaUpload],
    editMiddleware: [mediaUpload],
    overrideSelectHandler: async (params): Promise<SelectResponse> => {
        const {logger, languageCode, actionUserCtx, name, page, limit, company, notId, followUp, dslFilterQuery} = params;
        logger.start("Fetching inspections for select...");

        const sanitizedFields = SchemaGuard.sanitizeFields(Inspection, {name: {}, unit: {keys: {name: {}, unitNumber: {}}}}, "read", actionUserCtx, languageCode,);
        const populate = SchemaGuard.generatePopulate(sanitizedFields, Inspection.schema);

        const filter: Record<string, unknown> = {company: company._id};

        if (dslFilterQuery && Object.keys(dslFilterQuery as object).length > 0) {
            filter.$and = [...((filter.$and as unknown[]) ?? []), dslFilterQuery];
        }

        if (name !== undefined && name !== "") {
            const nameRegex = {$regex: escapeRegex(String(name).trim()), $options: "i"};
            const orConditions: Record<string, unknown>[] = [];
            if (sanitizedFields.type) orConditions.push({type: nameRegex});
            if (sanitizedFields.status) orConditions.push({status: nameRegex});
            if (orConditions.length === 1) {
                Object.assign(filter, orConditions[0]);
            } else if (orConditions.length > 1) {
                filter.$or = orConditions;
            }
        }

        if (notId !== undefined && notId !== "") filter._id = {$ne: new ObjectId(notId)};
        if (followUp) filter.followUpRequired = true;

        const [inspections, total] = await Promise.all([
            inspectionService.find(
                filter,
                {logger, languageCode},
                populate.populate,
                populate.select || "",
                {inspectionDate: -1},
                limit,
                (page - 1) * limit,
            ),
            inspectionService.count(filter, {logger, languageCode}),
        ]);

        logger.finish("Finished fetching inspections for select!");
        return {data: inspectionsToSelect(inspections), total};
    },
    extraListFilter: async (params) => {
        const {id, unitId, inspectedById, status, type, company, logger, languageCode} = params;
        if (id && ObjectId.isValid(id)) {
            return {_id: new ObjectId(id)};
        }
        const filter: Record<string, unknown> = {};
        if (unitId && ObjectId.isValid(unitId)) {
            const unit = await unitService.findOneOrThrow(
                {_id: new ObjectId(unitId), company: company._id},
                {logger, languageCode},
            );
            filter.unit = unit._id;
        }
        if (inspectedById && ObjectId.isValid(inspectedById)) filter.inspectedBy = new ObjectId(inspectedById);
        if (status) filter.status = status;
        if (type) filter.type = type;
        return filter;
    },
    buildCreateData: async ({unit, inspectedBy, followUpInspection, findings, status, cancellationReason, notes, session, logger, languageCode, company, ...params}: any) => {
        const [foundUnit, foundInspectedBy] = await Promise.all([
            unitService.findOneOrThrow(
                {_id: new ObjectId(unit), company: company._id},
                {session, logger, languageCode, withDeleted: false},
            ),
            userService.findOneOrThrow(
                {_id: new ObjectId(inspectedBy), "roles.company": company._id},
                {session, logger, languageCode, withDeleted: false},
            ),
        ]);

        if (followUpInspection) {
            const linked = await inspectionService.findOneOrThrow(
                {_id: new ObjectId(followUpInspection), company: company._id},
                {session, logger, languageCode, withDeleted: false},
            );
            if (linked.followedUpByInspection) {
                throw apiValidationException("follow_up_inspection_already_has_follower", null, null, languageCode);
            }
        }

        const resolvedStatus = status || InspectionStatus.SCHEDULED;

        const data = buildCreateDataFromSchemaDef(InspectionSchemaDef, {
            findings: (v) => cleanFindings(parseFindings(v)),
            rating: (v) => (v !== undefined && v !== null && v !== "" ? parseInt(String(v)) : undefined),
        })({
            ...params,
            unit: foundUnit._id,
            inspectedBy: foundInspectedBy._id,
            followUpInspection,
            notes,
            status: resolvedStatus,
            findings,
        });

        if (cancellationReason !== undefined && resolvedStatus === InspectionStatus.CANCELLED) {
            data.cancellationReason = cancellationReason;
        }

        return data;
    },
    afterCreate: async (created, params) => {
        const {session, logger, languageCode, actionUserCtx} = params;

        await unitService.updateByIdOrThrow(
            created.unit,
            {$push: {inspections: created._id}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId, auditAction: "create"},
        );

        if (created.followUpInspection) {
            await inspectionService.updateOne(
                {_id: created.followUpInspection},
                {$set: {followedUpByInspection: created._id}},
                {session, logger, languageCode},
            );
        }
    },
    buildUpdateData: async ({unit, inspectedBy, followUpInspection, findings, status, cancellationReason, session, logger, languageCode, company, existing, ...params}: any, writeFields) => {
        if (unit != null && writeFields.unit) {
            await unitService.findOneOrThrow(
                {_id: new ObjectId(unit), company: company._id},
                {session, logger, languageCode, withDeleted: false},
            );
        }

        if (inspectedBy != null && writeFields.inspectedBy) {
            await userService.findOneOrThrow(
                {_id: new ObjectId(inspectedBy), "roles.company": company._id},
                {session, logger, languageCode, withDeleted: false},
            );
        }

        if (followUpInspection !== undefined && writeFields.followUpInspection) {
            const previousId =
                (existing.followUpInspection as any)?._id?.toString?.() ??
                existing.followUpInspection?.toString?.();

            if (followUpInspection && followUpInspection !== previousId) {
                const target = await inspectionService.findOneOrThrow(
                    {_id: new ObjectId(followUpInspection), company: company._id},
                    {session, logger, languageCode, withDeleted: false},
                );
                if (target.followedUpByInspection) {
                    const followerId =
                        (target.followedUpByInspection as any)?._id?.toString?.() ??
                        (target.followedUpByInspection as any)?.toString?.();
                    if (followerId !== existing._id.toString()) {
                        throw apiValidationException(
                            "follow_up_inspection_already_has_follower",
                            null,
                            null,
                            languageCode,
                        );
                    }
                }
            }
        }

        const data = buildUpdateDataFromSchemaDef(InspectionSchemaDef, {
            findings: (v) => cleanFindings(parseFindings(v)),
        })({
            ...params,
            unit,
            inspectedBy,
            followUpInspection,
            findings,
            status,
        }, writeFields);

        if (cancellationReason !== undefined) {
            const currentStatus = (data.status ?? status ?? existing.status) as InspectionStatus;
            if (currentStatus === InspectionStatus.CANCELLED) {
                data.cancellationReason = cancellationReason;
            }
        }

        return data;
    },
    afterUpdate: async (params, existingBeforeUpdate) => {
        const {status, followUpInspection, session, logger, languageCode, sanitizedWriteFields} = params;

        if (status !== undefined && sanitizedWriteFields?.status && status !== InspectionStatus.CANCELLED) {
            await inspectionService.updateOne(
                {_id: existingBeforeUpdate._id},
                {$unset: {cancelledAt: "", cancellationReason: ""}},
                {session, logger, languageCode},
            );
        }

        if (followUpInspection !== undefined && sanitizedWriteFields?.followUpInspection) {
            const previousId =
                (existingBeforeUpdate.followUpInspection as any)?._id?.toString?.() ??
                existingBeforeUpdate.followUpInspection?.toString?.();

            if (previousId && previousId !== followUpInspection) {
                await inspectionService.updateOne(
                    {_id: new ObjectId(previousId), followedUpByInspection: existingBeforeUpdate._id},
                    {$unset: {followedUpByInspection: ""}},
                    {session, logger, languageCode},
                );
            }
            if (followUpInspection) {
                await inspectionService.updateOne(
                    {_id: new ObjectId(followUpInspection)},
                    {$set: {followedUpByInspection: existingBeforeUpdate._id}},
                    {session, logger, languageCode},
                );
            }
        }
    },
    beforeDelete: async (params, doc) => {
        const {session, logger, languageCode, company} = params;

        await unitService.findOneOrThrow({_id: doc.unit, company: company._id}, {session, logger, languageCode});

        if (doc.followUpInspection) {
            await inspectionService.updateOne(
                {_id: doc.followUpInspection, followedUpByInspection: doc._id},
                {$unset: {followedUpByInspection: ""}},
                {session, logger, languageCode},
            );
        }
        if ((doc as any).followedUpByInspection) {
            await inspectionService.updateOne(
                {_id: (doc as any).followedUpByInspection, followUpInspection: doc._id},
                {$unset: {followUpInspection: ""}},
                {session, logger, languageCode},
            );
        }
    },
    afterDelete: async (params, doc) => {
        const {session, logger, languageCode, actionUserCtx} = params;
        const unitRefId = (doc.unit as any)?._id ?? doc.unit;
        await unitService.updateByIdOrThrow(
            new ObjectId(unitRefId.toString()),
            {$pull: {inspections: doc._id}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
    },
    overrideRestoreHandler: async (params) => {
        const {logger, languageCode, session, _id, company, actionUserCtx} = params;
        SchemaGuard.checkModelPermission(Inspection, "restore", actionUserCtx, languageCode);

        const restored = await inspectionService.restoreOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const unitRefId = (restored.unit as any)?._id ?? restored.unit;
        await unitService.findOneOrThrow(
            {_id: new ObjectId(unitRefId.toString()), company: company._id},
            {session, logger, languageCode},
        );

        await unitService.updateByIdOrThrow(
            new ObjectId(unitRefId.toString()),
            {$push: {inspections: restored._id}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId, auditAction: "restore"},
        );

        return {message: "Inspection successfully restored"};
    },
    actions: InspectionActions,
});
