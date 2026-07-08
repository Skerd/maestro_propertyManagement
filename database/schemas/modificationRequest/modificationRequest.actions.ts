import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {schemaSanitizer} from "@coreModule/utilities/middlewares/schemaSanitizerMW";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {approveModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/approveModificationRequest.form.validator";
import {submitRevisionModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/submitRevisionModificationRequest.form.validator";
import {financeModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/fiinanceModificationRequest.form.validator";
import {deliverModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/deliverModificationRequest.form.validator";
import {clientCostApproveModificationRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/clientCostApproveModificationRequest.form.validator";
import ModificationRequest, {
    ApprovalDecision,
    ModificationRequestStatus,
} from "./modificationRequest";
import {modificationRequestService} from "./modificationRequest.service";
import {unitService} from "../unit/unit.service";
import {inspectionService} from "../inspection/inspection.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {modificationRequestToDTO} from "@propertyManagement/utilities/mappers/modificationRequest/modificationRequestMapper.dto";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import type {ModificationRequest as ModificationRequestData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.dto";

function mapMaterialsPlanItem(item: any) {
    const {Decimal128} = require("mongodb");
    return {
        item:         item.item,
        quantity:     item.quantity,
        unit:         item.unit,
        notes:        item.notes,
        pricePerUnit: item.pricePerUnit != null ? Decimal128.fromString(String(item.pricePerUnit)) : undefined,
        currency:     item.currency ? new ObjectId(item.currency) : undefined,
    };
}

export class ModificationRequestActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        middleware: [schemaSanitizer({model: "modificationrequests", requiredModes: ["write"]})],
        schema: approveModificationRequestFormSchema,
    })
    async approve(params: Record<string, any>): Promise<ModificationRequestData | undefined> {
        const {logger, languageCode, session, _id, stage, decision, notes, media, actionUserCtx, company, sanitizedWriteFields} = params;
        const materialsPlan = params.materialsPlan;

        logger.start(`Approving modification request: ${_id} at stage: ${stage}...`);

        const existingRequest = await modificationRequestService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        await unitService.findOneOrThrow({_id: existingRequest.unit, company: company._id}, {session, logger, languageCode});

        const canApproveArchitect = !!sanitizedWriteFields?.architectApproval?.keys;
        const canApproveEngineer  = !!sanitizedWriteFields?.engineerApproval?.keys;
        const canApproveCeo       = !!sanitizedWriteFields?.ceoApproval?.keys;
        const decisionEnum        = decision === "approved" ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED;
        const mediaIds            = Array.isArray(media) ? media : media ? [media] : [];

        let updateData: any = {
            decision: decisionEnum,
            notes,
            user:       new ObjectId(actionUserCtx.userId),
            reviewedAt: new Date(),
            media:      mediaIds.length > 0 ? mediaIds.map((id: string) => new ObjectId(id)) : undefined,
        };

        if (stage === "architect") {
            if (!canApproveArchitect) throw apiValidationException("unauthorized_to_approve", null, null, languageCode);
            if (existingRequest.status !== ModificationRequestStatus.PENDING_ARCHITECT && existingRequest.status !== ModificationRequestStatus.PENDING_ARCHITECT_REVISION) {
                throw apiValidationException("invalid_status_for_approval", null, null, languageCode);
            }
            updateData = {
                architectApproval: updateData,
                status: decisionEnum === ApprovalDecision.APPROVED ? ModificationRequestStatus.PENDING_ENGINEER : ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
            };
        } else if (stage === "engineer") {
            if (!canApproveEngineer) throw apiValidationException("unauthorized_to_approve", null, null, languageCode);
            if (existingRequest.status !== ModificationRequestStatus.PENDING_ENGINEER && existingRequest.status !== ModificationRequestStatus.PENDING_ENGINEER_REVISION) {
                throw apiValidationException("invalid_status_for_approval", null, null, languageCode);
            }
            if (Array.isArray(materialsPlan) && materialsPlan.length > 0) {
                updateData.materialsPlan = materialsPlan.map(mapMaterialsPlanItem);
            }
            updateData = {
                engineerApproval: updateData,
                status: decisionEnum === ApprovalDecision.APPROVED ? ModificationRequestStatus.PENDING_CEO : ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
            };
        } else if (stage === "ceo") {
            if (!canApproveCeo) throw apiValidationException("unauthorized_to_approve", null, null, languageCode);
            if (existingRequest.status !== ModificationRequestStatus.PENDING_CEO) {
                throw apiValidationException("invalid_status_for_approval", null, null, languageCode);
            }
            updateData = {
                ceoApproval: updateData,
                status: decisionEnum === ApprovalDecision.APPROVED ? ModificationRequestStatus.PENDING_FINANCE : ModificationRequestStatus.PENDING_ENGINEER_REVISION,
            };
        }

        await modificationRequestService.updateByIdOrThrow(
            existingRequest._id,
            {$set: updateData},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        let returnData: ModificationRequestData | undefined;
        try {
            const readFields = getModelCollectedData("modificationrequests").readFields!;
            const populate = SchemaGuard.generatePopulate(readFields, ModificationRequest.schema);
            const updated = await modificationRequestService.findById(existingRequest._id, {session, logger, languageCode}, populate.populate);
            returnData = modificationRequestToDTO(updated);
        } catch {
            logger.debug("User has no read permission on modification request!");
        }

        const requestedById = existingRequest.requestedBy?._id?.toString() ?? existingRequest.requestedBy?.toString();
        if (requestedById) {
            const eventCode = decisionEnum === ApprovalDecision.APPROVED
                ? NotificationEventCodes.MODIFICATION_REQUEST_APPROVED
                : NotificationEventCodes.MODIFICATION_REQUEST_REJECTED;
            emitNotificationEvent(eventCode, {
                receiverIds: [requestedById],
                payload: {
                    companyId: company._id.toString(),
                    modificationRequestId: existingRequest._id.toString(),
                    title: existingRequest.title,
                    stage,
                    notes,
                    newStatus: updateData.status,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Successfully approved modification request: ${_id}`);
        return returnData;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        middleware: [schemaSanitizer({model: "modificationrequests", requiredModes: ["write"]})],
        schema: submitRevisionModificationRequestFormSchema,
    })
    async submitRevision(params: Record<string, any>): Promise<ModificationRequestData | undefined> {
        const {logger, languageCode, session, _id, targetStage, actionUserCtx, company, sanitizedWriteFields} = params;

        const canApproveArchitect = !!sanitizedWriteFields?.architectApproval?.keys;
        const canApproveEngineer  = !!sanitizedWriteFields?.engineerApproval?.keys;
        const canApproveCeo       = !!sanitizedWriteFields?.ceoApproval?.keys;

        if (!canApproveArchitect && !canApproveEngineer && !canApproveCeo) {
            throw apiValidationException("unauthorized_to_approve", null, null, languageCode);
        }

        const existingRequest = await modificationRequestService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        await unitService.findOneOrThrow({_id: existingRequest.unit, company: company._id}, {session, logger, languageCode});

        const updateData: Record<string, unknown> = {};
        if (targetStage === "architect" && existingRequest.status === ModificationRequestStatus.PENDING_ARCHITECT_REVISION) {
            updateData.status = ModificationRequestStatus.PENDING_ARCHITECT;
        } else if (targetStage === "engineer" && existingRequest.status === ModificationRequestStatus.PENDING_ENGINEER_REVISION) {
            updateData.status = ModificationRequestStatus.PENDING_ENGINEER;
        } else {
            throw apiValidationException("invalid_status_transition", null, null, languageCode);
        }

        await modificationRequestService.updateByIdOrThrow(
            existingRequest._id,
            {$set: updateData},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        let returnData: ModificationRequestData | undefined;
        try {
            const readFields = getModelCollectedData("modificationrequests").readFields!;
            const populate = SchemaGuard.generatePopulate(readFields, ModificationRequest.schema);
            const updated = await modificationRequestService.findById(existingRequest._id, {session, logger, languageCode}, populate.populate);
            returnData = modificationRequestToDTO(updated);
        } catch {
            logger.debug("User has no read permission on modification request!");
        }

        const requestedById = existingRequest.requestedBy?._id?.toString() ?? existingRequest.requestedBy?.toString();
        if (requestedById) {
            emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_REVISION_SUBMITTED, {
                receiverIds: [requestedById],
                payload: {
                    companyId: company._id.toString(),
                    modificationRequestId: existingRequest._id.toString(),
                    title: existingRequest.title,
                    newStatus: updateData.status,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        return returnData;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: financeModificationRequestFormSchema,
    })
    async finance(params: Record<string, any>): Promise<ModificationRequestData | undefined> {
        const {logger, languageCode, session, _id, totalCost, currency, costBreakdown, media, notes, estimatedCompletionDate, actionUserCtx, company} = params;

        logger.start(`Adding finance details to modification request: ${_id}...`);

        const existingRequest = await modificationRequestService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        await unitService.findOneOrThrow({_id: existingRequest.unit, company: company._id}, {session, logger, languageCode});

        if (existingRequest.status !== ModificationRequestStatus.PENDING_FINANCE) {
            throw apiValidationException("invalid_status_for_finance", null, null, languageCode);
        }

        const mediaIds = Array.isArray(media) ? media : media ? [media] : [];

        const seededBreakdown = (existingRequest.engineerApproval?.materialsPlan || []).map((item: any) => ({
            item: item.item, cost: 0, quantity: item.quantity, unit: item.unit, source: "engineer_material",
        }));

        const currencyDoc = await currencyService.findOneOrThrow({_id: new ObjectId(currency), company: company._id});

        const updateData = {
            status: ModificationRequestStatus.PENDING_CLIENT_APPROVAL,
            financeDetails: {
                totalCost,
                currency: currencyDoc,
                media: mediaIds.length > 0 ? mediaIds.map((id: string) => new ObjectId(id)) : undefined,
                notes,
                estimatedCompletionDate: estimatedCompletionDate ? new Date(estimatedCompletionDate) : undefined,
                costBreakdown: ((costBreakdown && costBreakdown.length > 0 ? costBreakdown : seededBreakdown) || []).map((item: any) => ({
                    item: item.item, cost: item.cost, quantity: item.quantity, unit: item.unit, source: item.source || "manual",
                })),
            },
        };

        await modificationRequestService.updateByIdOrThrow(
            existingRequest.id,
            {$set: updateData},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        let returnData: ModificationRequestData | undefined;
        try {
            const readFields = getModelCollectedData("modificationrequests").readFields!;
            const populate = SchemaGuard.generatePopulate(readFields, ModificationRequest.schema);
            const updated = await modificationRequestService.findById(existingRequest._id, {session, logger, languageCode}, populate.populate);
            returnData = modificationRequestToDTO(updated);
        } catch {
            logger.debug("User has no read permission on modification request!");
        }

        const requestedById = existingRequest.requestedBy?._id?.toString() ?? existingRequest.requestedBy?.toString();
        if (requestedById) {
            emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_CLIENT_COST_PENDING, {
                receiverIds: [requestedById],
                payload: {
                    companyId: company._id.toString(),
                    modificationRequestId: existingRequest._id.toString(),
                    title: existingRequest.title,
                    totalCost: totalCost?.toString(),
                    currencyId: currency,
                    currencySymbol: currencyDoc?.symbol,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Successfully added finance details to modification request: ${_id}`);
        return returnData;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: deliverModificationRequestFormSchema,
    })
    async deliver(params: Record<string, any>): Promise<ModificationRequestData | undefined> {
        const {logger, languageCode, session, _id, notes, inspections, media, actionUserCtx, company} = params;

        logger.start(`Marking modification request as delivered: ${_id}...`);

        const existingRequest = await modificationRequestService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        await unitService.findOneOrThrow({_id: existingRequest.unit, company: company._id}, {session, logger, languageCode});

        if (existingRequest.status !== ModificationRequestStatus.FINANCE_COMPLETED && existingRequest.status !== ModificationRequestStatus.PENDING_DELIVERY) {
            throw apiValidationException("invalid_status_for_deliver", null, null, languageCode);
        }

        const inspectionsDb = inspections
            ? await inspectionService.find({company: company._id, unit: existingRequest.unit, _id: {$in: inspections}})
            : undefined;

        const updateData = {
            deliveryApproval: {
                decision:   ApprovalDecision.APPROVED,
                user:       new ObjectId(actionUserCtx.userId),
                reviewedAt: new Date(),
                notes,
                media:       media ? (Array.isArray(media) ? media.map((id: string) => new ObjectId(id)) : [new ObjectId(media)]) : undefined,
                inspections: inspectionsDb,
            },
            inspections:  inspectionsDb,
            status:       ModificationRequestStatus.COMPLETED,
            completedAt:  new Date(),
        };

        await modificationRequestService.updateByIdOrThrow(
            existingRequest.id,
            {$set: updateData},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        let returnData: ModificationRequestData | undefined;
        try {
            const readFields = getModelCollectedData("modificationrequests").readFields!;
            const populate = SchemaGuard.generatePopulate(readFields, ModificationRequest.schema);
            const updated = await modificationRequestService.findById(existingRequest._id, {session, logger, languageCode}, populate.populate);
            returnData = modificationRequestToDTO(updated);
        } catch {
            logger.debug("User has no read permission on modification request!");
        }

        const requestedById = existingRequest.requestedBy?._id?.toString() ?? existingRequest.requestedBy?.toString();
        if (requestedById) {
            emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_DELIVERED, {
                receiverIds: [requestedById],
                payload: {
                    companyId: company._id.toString(),
                    modificationRequestId: existingRequest._id.toString(),
                    title: existingRequest.title,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Successfully marked modification request as delivered: ${_id}`);
        return returnData;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: clientCostApproveModificationRequestFormSchema,
    })
    async clientCostApprove(params: Record<string, any>): Promise<ModificationRequestData | undefined> {
        const {logger, languageCode, session, _id, decision, notes, actionUserCtx, company} = params;

        logger.start(`Client cost approval for modification request: ${_id}, decision: ${decision}...`);

        const existingRequest = await modificationRequestService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (existingRequest.status !== ModificationRequestStatus.PENDING_CLIENT_APPROVAL) {
            throw apiValidationException("invalid_status_for_client_approval", null, null, languageCode);
        }

        const approved  = decision === "approved";
        const newStatus = approved ? ModificationRequestStatus.FINANCE_COMPLETED : ModificationRequestStatus.PENDING_FINANCE;

        await modificationRequestService.updateByIdOrThrow(
            existingRequest._id,
            {
                $set: {
                    status: newStatus,
                    clientCostApproval: {
                        decision,
                        user:       new ObjectId(actionUserCtx.userId),
                        reviewedAt: new Date(),
                        notes:      notes ?? "",
                    },
                },
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        let returnData: ModificationRequestData | undefined;
        try {
            const readFields = getModelCollectedData("modificationrequests").readFields!;
            const populate = SchemaGuard.generatePopulate(readFields, ModificationRequest.schema);
            const updated = await modificationRequestService.findById(existingRequest._id, {session, logger, languageCode}, populate.populate);
            returnData = modificationRequestToDTO(updated);
        } catch {
            logger.debug("User has no read permission on modification request!");
        }

        const requestedById = existingRequest.requestedBy?._id?.toString() ?? existingRequest.requestedBy?.toString();
        if (requestedById) {
            const eventCode = approved
                ? NotificationEventCodes.MODIFICATION_REQUEST_CLIENT_COST_APPROVED
                : NotificationEventCodes.MODIFICATION_REQUEST_CLIENT_COST_REJECTED;
            emitNotificationEvent(eventCode, {
                receiverIds: [requestedById],
                payload: {
                    companyId: company._id.toString(),
                    modificationRequestId: existingRequest._id.toString(),
                    title: existingRequest.title,
                    notes,
                    newStatus,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        logger.finish(`Client cost approval processed for modification request: ${_id}`);
        return returnData;
    }
}
