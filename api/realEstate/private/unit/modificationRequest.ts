import {Decimal128, ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {modificationRequestService} from "../../../../database/schemas/modificationRequest/modificationRequest.service";
import {unitService} from "../../../../database/schemas/unit/unit.service";
import {escapeRegex} from "@coreModule/utilities/helpers";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import ModificationRequest, {ApprovalDecision, ModificationRequestStatus} from "../../../../database/schemas/modificationRequest/modificationRequest";
import {modificationRequestsToDTO, modificationRequestToDTO} from "../../../../utilities/mappers/modificationRequest/modificationRequestMapper.dto";
import type {SelectResponse} from "armonia/src/modules/core/types/shared.types";
import type {ModificationRequest as ModificationRequestData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.dto";
import {modificationRequestSelectFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.select.form.validator";
import {modificationRequestsToSelect} from "../../../../utilities/mappers/modificationRequest/modificationRequestMapper.select";
import {createModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/createModificationRequest.form.validator";
import {editModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/editModificationRequest.form.validator";
import {modificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.form.validator";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {ModificationRequestActions} from "../../../../database/schemas/modificationRequest/modificationRequest.actions";

export const basePath = "/api/realEstate/unit/modificationRequest";

function mapMaterialsPlanItem(item: any) {
    return {
        item:         item.item,
        quantity:     item.quantity,
        unit:         item.unit,
        notes:        item.notes,
        pricePerUnit: item.pricePerUnit != null ? Decimal128.fromString(String(item.pricePerUnit)) : undefined,
        currency:     item.currency ? new ObjectId(item.currency) : undefined,
    };
}

export const {router} = createCrudRouter({
    collectionName: "modificationrequests",
    model: ModificationRequest,
    service: modificationRequestService,
    createSchema: createModificationRequestFormSchema,
    editSchema: editModificationRequestFormSchema,
    listSchema: modificationRequestFormSchema,
    selectSchema: modificationRequestSelectFormSchema,
    toDTO: modificationRequestToDTO,
    toDTOArray: modificationRequestsToDTO,
    toSelect: modificationRequestsToSelect,
    defaultSort: {submittedAt: -1},
    selectSort: {submittedAt: -1},
    overrideSelectHandler: async (params): Promise<SelectResponse> => {
        const {logger, languageCode, actionUserCtx, company, name, page, limit, notId, dslFilterQuery} = params;
        logger.start("Fetching modification requests for select...");

        const sanitizedFields = SchemaGuard.sanitizeFields(ModificationRequest, {name: {}, status: {}, unit: {keys: {name: {}, unitNumber: {}}}}, "read", actionUserCtx, languageCode,);
        const populate = SchemaGuard.generatePopulate(sanitizedFields, ModificationRequest.schema);
        const opts = {logger, languageCode};

        const companyUnits = await unitService.find({company: company._id}, opts, null, "_id", {}, undefined, undefined);
        const companyUnitIds = companyUnits.map((u) => u._id).filter((id): id is ObjectId => id != null);

        const filter: Record<string, unknown> = {unit: {$in: companyUnitIds}, company: company._id};

        if (dslFilterQuery && Object.keys(dslFilterQuery as object).length > 0) {
            filter.$and = [...((filter.$and as unknown[]) ?? []), dslFilterQuery];
        }
        if (notId !== undefined && notId !== "") filter._id = {$ne: new ObjectId(notId)};
        if (name !== undefined && name !== "" && sanitizedFields.title) {
            filter.title = {$regex: escapeRegex(String(name).trim()), $options: "i"};
        }

        const [requests, total] = await Promise.all([
            modificationRequestService.find(filter, opts, populate.populate, populate.select || "", {submittedAt: -1}, limit, (page - 1) * limit),
            modificationRequestService.count(filter, opts),
        ]);

        logger.finish("Finished fetching modification requests for select!");
        return {data: modificationRequestsToSelect(requests), total};
    },
    extraListFilter: async (params) => {
        const {unitId, projectId, edificeId, floorId, company, logger, languageCode} = params;
        const opts = {logger, languageCode};

        const companyUnits = await unitService.find({company: company._id}, opts, null, "_id", {}, undefined, undefined);
        const companyUnitIds = companyUnits.map((u) => u._id).filter((id): id is ObjectId => id != null);

        const filter: Record<string, unknown> = {unit: {$in: companyUnitIds}};

        if (unitId && ObjectId.isValid(unitId)) {
            const unit = await unitService.findOneOrThrow({_id: new ObjectId(unitId), company: company._id}, opts);
            filter.unit = unit._id;
        } else if (projectId || edificeId || floorId) {
            if (projectId) filter["unit.floor.edifice.project"] = {company: company._id, _id: new ObjectId(projectId)};
            if (edificeId) filter["unit.floor.edifice"] = {company: company._id, _id: new ObjectId(edificeId)};
            if (floorId) filter["unit.floor"] = {company: company._id, _id: new ObjectId(floorId)};
        }

        return filter;
    },
    buildCreateData: async (params) => {
        const {unit, requestedBy, title, description, constructionType, specifications, session, logger, languageCode, company} = params;

        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            {session, logger, languageCode},
        );

        return {
            unit: foundUnit._id,
            requestedBy: new ObjectId(requestedBy),
            title,
            description,
            constructionType,
            specifications,
            status: ModificationRequestStatus.PENDING_ARCHITECT,
            architectApproval: {decision: ApprovalDecision.PENDING},
            engineerApproval: {decision: ApprovalDecision.PENDING},
            ceoApproval: {decision: ApprovalDecision.PENDING},
            deliveryApproval: {decision: ApprovalDecision.PENDING},
            inspections: [],
            notificationSent: false,
        };
    },
    afterCreate: async (created, params) => {
        const {requestedBy, session, logger, languageCode, actionUserCtx, company} = params;

        const foundUnit = await unitService.findOneOrThrow(
            {_id: created.unit, company: company._id},
            {session, logger, languageCode},
        );

        await unitService.updateByIdOrThrow(
            foundUnit._id,
            {$push: {modificationRequests: created._id}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId, auditUserCtx: actionUserCtx},
        );

        emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_CREATED, {
            receiverIds: [requestedBy],
            payload: {
                companyId: company._id.toString(),
                modificationRequestId: created._id.toString(),
                title: created.title,
                unitId: foundUnit._id.toString(),
                unitNumber: (foundUnit as any).unitNumber,
                status: ModificationRequestStatus.PENDING_ARCHITECT,
                languageCode: languageCode ?? "en-US",
            },
        });
    },
    buildUpdateData: async (params, writeFields) => {
        const {
            title, description, specifications, cancellationReason, unit,
            architectApproval, engineerApproval, ceoApproval, financeDetails,
            session, logger, languageCode, company, existing, actionUserCtx,
        } = params;

        if (existing.status === ModificationRequestStatus.COMPLETED) {
            throw apiValidationException("cannot_edit_after_delivery", null, null, languageCode);
        }

        await unitService.findOneOrThrow({_id: existing.unit, company: company._id}, {session, logger, languageCode});

        const update: Record<string, unknown> = {};

        if (title !== undefined && writeFields.title) update.title = title;
        if (description !== undefined && writeFields.description) update.description = description;
        if (specifications !== undefined && writeFields.specifications) update.specifications = specifications;

        if (cancellationReason !== undefined) {
            if ((cancellationReason === "" || cancellationReason === null) && existing.status === ModificationRequestStatus.CANCELLED) {
                update.status = ModificationRequestStatus.PENDING_ARCHITECT;
            } else if (cancellationReason) {
                update.cancellationReason = cancellationReason;
                update.status = ModificationRequestStatus.CANCELLED;
            }
        }

        if (writeFields.architectApproval?.keys) {
            const archKeys = writeFields.architectApproval.keys;
            if (architectApproval?.decision && (architectApproval.decision === "approved" || architectApproval.decision === "rejected") && archKeys.decision) {
                const decisionEnum = architectApproval.decision === "approved" ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED;
                update["architectApproval.decision"] = decisionEnum;
                update["architectApproval.notes"] = architectApproval.notes ?? (existing.architectApproval as any)?.notes ?? "";
                update["architectApproval.reviewedAt"] = new Date();
                update["architectApproval.user"] = new ObjectId(actionUserCtx.userId);
                update.status = decisionEnum === ApprovalDecision.APPROVED
                    ? ModificationRequestStatus.PENDING_ENGINEER
                    : ModificationRequestStatus.PENDING_ARCHITECT_REVISION;
            } else if (architectApproval?.notes !== undefined && archKeys.notes) {
                update["architectApproval.notes"] = architectApproval.notes;
            }
        }

        if (writeFields.engineerApproval?.keys) {
            const engKeys = writeFields.engineerApproval.keys;
            if (engineerApproval?.decision && (engineerApproval.decision === "approved" || engineerApproval.decision === "rejected") && engKeys.decision) {
                const decisionEnum = engineerApproval.decision === "approved" ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED;
                update["engineerApproval.decision"] = decisionEnum;
                update["engineerApproval.notes"] = engineerApproval.notes ?? (existing.engineerApproval as any)?.notes ?? "";
                update["engineerApproval.reviewedAt"] = new Date();
                update["engineerApproval.user"] = new ObjectId(actionUserCtx.userId);
                if (Array.isArray((engineerApproval as any)?.materialsPlan) && engKeys.materialsPlan) {
                    update["engineerApproval.materialsPlan"] = (engineerApproval as any).materialsPlan.map(mapMaterialsPlanItem);
                }
                update.status = decisionEnum === ApprovalDecision.APPROVED
                    ? ModificationRequestStatus.PENDING_CEO
                    : ModificationRequestStatus.PENDING_ARCHITECT_REVISION;
            } else if (engineerApproval?.notes !== undefined && engKeys.notes) {
                update["engineerApproval.notes"] = engineerApproval.notes;
            } else if ((engineerApproval as any)?.materialsPlan !== undefined && engKeys.materialsPlan) {
                update["engineerApproval.materialsPlan"] = ((engineerApproval as any).materialsPlan || []).map(mapMaterialsPlanItem);
            }
        }

        if (writeFields.ceoApproval?.keys) {
            const ceoKeys = writeFields.ceoApproval.keys;
            if (ceoApproval?.decision && (ceoApproval.decision === "approved" || ceoApproval.decision === "rejected") && ceoKeys.decision) {
                const decisionEnum = ceoApproval.decision === "approved" ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED;
                update["ceoApproval.decision"] = decisionEnum;
                update["ceoApproval.notes"] = ceoApproval.notes ?? (existing.ceoApproval as any)?.notes ?? "";
                update["ceoApproval.reviewedAt"] = new Date();
                update["ceoApproval.user"] = new ObjectId(actionUserCtx.userId);
                update.status = decisionEnum === ApprovalDecision.APPROVED
                    ? ModificationRequestStatus.PENDING_FINANCE
                    : ModificationRequestStatus.PENDING_ENGINEER_REVISION;
            } else if (ceoApproval?.notes !== undefined && ceoKeys.notes) {
                update["ceoApproval.notes"] = ceoApproval.notes;
            }
        }

        if (financeDetails !== undefined && writeFields.financeDetails?.keys) {
            const fdKeys = writeFields.financeDetails.keys;
            if (fdKeys.totalCost && financeDetails.totalCost !== undefined) {
                const n = Number(financeDetails.totalCost);
                update["financeDetails.totalCost"] = Number.isNaN(n) ? 0 : n;
            }
            if (fdKeys.currency && financeDetails.currency !== undefined && ObjectId.isValid(financeDetails.currency)) {
                update["financeDetails.currency"] = new ObjectId(financeDetails.currency);
            }
            if (fdKeys.notes && financeDetails.notes !== undefined) update["financeDetails.notes"] = financeDetails.notes;
            if (fdKeys.estimatedCompletionDate && financeDetails.estimatedCompletionDate !== undefined) {
                update["financeDetails.estimatedCompletionDate"] = financeDetails.estimatedCompletionDate
                    ? new Date(financeDetails.estimatedCompletionDate)
                    : undefined;
            }
            if (fdKeys.costBreakdown?.keys && financeDetails.costBreakdown !== undefined) {
                update["financeDetails.costBreakdown"] = financeDetails.costBreakdown.map((item: any) => ({
                    item: item.item, cost: item.cost, quantity: item.quantity, unit: item.unit, source: item.source || "manual",
                }));
            }
        }

        if (unit !== undefined && writeFields.unit) {
            await unitService.findOneOrThrow({company: company._id, _id: new ObjectId(unit)}, {session, logger, languageCode});
            update.unit = new ObjectId(unit);
        }

        return update;
    },
    afterUpdate: async (params, existingBeforeUpdate) => {
        const {cancellationReason, session, logger, languageCode, company} = params;

        const wasUnCancelled =
            (cancellationReason === "" || cancellationReason === null) &&
            existingBeforeUpdate.status === ModificationRequestStatus.CANCELLED;

        if (wasUnCancelled) {
            await modificationRequestService.updateOne(
                {_id: existingBeforeUpdate._id},
                {$unset: {cancellationReason: "", cancelledAt: ""}},
                {session, logger, languageCode},
            );

            const requestedById =
                (existingBeforeUpdate.requestedBy as any)?._id?.toString() ??
                existingBeforeUpdate.requestedBy?.toString();
            if (requestedById) {
                emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_REACTIVATED, {
                    receiverIds: [requestedById],
                    payload: {
                        companyId: company._id.toString(),
                        modificationRequestId: existingBeforeUpdate._id.toString(),
                        title: existingBeforeUpdate.title,
                        languageCode: languageCode ?? "en-US",
                    },
                });
            }
        }

        if (cancellationReason && typeof cancellationReason === "string" && cancellationReason.trim() !== "") {
            const requestedById =
                (existingBeforeUpdate.requestedBy as any)?._id?.toString() ??
                existingBeforeUpdate.requestedBy?.toString();
            if (requestedById) {
                emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_CANCELLED, {
                    receiverIds: [requestedById],
                    payload: {
                        companyId: company._id.toString(),
                        modificationRequestId: existingBeforeUpdate._id.toString(),
                        title: existingBeforeUpdate.title,
                        cancellationReason,
                        languageCode: languageCode ?? "en-US",
                    },
                });
            }
        }
    },
    beforeDelete: async (params, doc) => {
        const {session, logger, languageCode, company} = params;
        await unitService.findOneOrThrow({_id: doc.unit, company: company._id}, {session, logger, languageCode});
    },
    overrideRestoreHandler: async (params) => {
        const {logger, languageCode, session, _id, company, actionUserCtx} = params;
        SchemaGuard.checkModelPermission(ModificationRequest, "restore", actionUserCtx, languageCode);

        const found = await modificationRequestService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const unit = await unitService.findOneOrThrow(
            {_id: found.unit, company: company._id},
            {session, logger, languageCode},
        );

        await modificationRequestService.restoreOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        await unitService.updateByIdOrThrow(
            unit._id,
            {$push: {modificationRequests: found._id}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId, auditAction: "restore"},
        );

        return {message: "Modification request successfully restored"};
    },
    actions: ModificationRequestActions,
});
