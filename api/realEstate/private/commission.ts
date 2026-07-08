import {Decimal128, ObjectId} from "mongodb";
import {z} from "zod";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {transactionHandler} from "@coreModule/utilities/middlewares/transactionHandler";
import {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {commissionService} from "../../../database/schemas/commission/commission.service";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import Commission, {CommissionStatus} from "../../../database/schemas/commission/commission";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {commissionsToDTO, commissionToDTO} from "../../../utilities/mappers/commission/commissionMapper.dto";
import {COLLECTED_DATA} from "@coreModule/database/collections";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import type {Commission as CommissionDto} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/commission.dto";
import {SingleForm} from "armonia/src/modules/core/types/shared.types";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";

export const basePath = "/api/realEstate/commission";

// Commissions are system-generated; no user-facing create/edit/delete/restore.
// - create/delete/restore: blocked by "no-permission" in schema model permissions.
// - edit: blocked by schemaSanitizer (all fields write: "no-permission"); buildUpdateData is a no-op for any edge case.
export const {router} = createCrudRouter({
    collectionName: "commissions",
    model: Commission,
    service: commissionService,
    createSchema: () => z.object({}).passthrough() as any,
    editSchema: () => z.object({_id: z.string()}).passthrough() as any,
    toDTO: commissionToDTO,
    toDTOArray: commissionsToDTO,
    toSelect: () => [],
    buildCreateData: () => ({}),
    buildUpdateData: () => ({}),
    defaultSort: {createdAt: -1},
});

// ── PATCH /markPaid ───────────────────────────────────────────────────────────

router.patch(
    "/markPaid",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod((lang) => validateSingleForm(lang).extend({
        paymentReference: z.string().optional(),
        paymentReceiptMediaId: z.string().optional(),
    })),
    transactionHandler(),
    asyncHandler(markCommissionPaid)
);

type MarkCommissionPaidType = AuthenticatedMWType & TransactionRequiredParams & SingleForm & {
    paymentReference?: string;
    paymentReceiptMediaId?: string;
};

async function markCommissionPaid(params: MarkCommissionPaidType): Promise<CommissionDto> {
    const {logger, languageCode, session, _id, actionUserCtx, company, paymentReference, paymentReceiptMediaId} = params;

    logger.start(`Marking commission paid: ${_id}...`);

    SchemaGuard.sanitizeFields(Commission, {status: {}}, "write", actionUserCtx, languageCode);

    const existing = await commissionService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id, status: CommissionStatus.PENDING},
        {session, logger, languageCode},
        [{path: "currency", select: "symbol name"}]
    );

    const paidSetFields: Record<string, any> = {
        status: CommissionStatus.PAID,
        paidAt: new Date(),
    };
    if (paymentReference) paidSetFields.paymentReference = paymentReference;
    if (paymentReceiptMediaId) paidSetFields.paymentReceiptMediaId = new ObjectId(paymentReceiptMediaId);

    await commissionService.updateByIdOrThrow(
        existing._id,
        { $set: paidSetFields },
        {session, logger, languageCode, auditUserId: actionUserCtx.userId}
    );

    let returnCommission = undefined;
    try {
        const readSanitizedFields = SchemaGuard.sanitizeFields(Commission, COLLECTED_DATA["commissions"].readFields, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(readSanitizedFields, Commission.schema);
        const populatedCommission = await commissionService.findById(
            existing._id,
            {session, logger, languageCode},
            populate.populate
        );
        returnCommission = commissionToDTO(populatedCommission);
    } catch (e) {
        logger.debug("User has no read permission on commission!");
    }

    const agentId = (existing.agent as any)?._id?.toString() ?? existing.agent?.toString();
    if (agentId) {
        emitNotificationEvent(NotificationEventCodes.COMMISSION_PAID, {
            receiverIds: [agentId],
            payload: {
                companyId: company._id.toString(),
                commissionId: existing._id.toString(),
                amount: existing.amount?.toString(),
                currencyId: (existing.currency as any)?._id?.toString() ?? existing.currency?.toString(),
                currencySymbol: (existing.currency as any)?.symbol,
                sourceType: existing.sourceType,
                sourceId: existing.sourceId?.toString(),
                languageCode: languageCode ?? "en-US",
            },
        });
    }

    logger.finish(`Successfully marked commission paid: ${_id}`);
    if (returnCommission === undefined) {
        throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
    }
    return returnCommission;
}

// ── PATCH /markPending ────────────────────────────────────────────────────────
router.patch(
    "/markPending",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(validateSingleForm),
    transactionHandler(),
    asyncHandler(markCommissionPending)
);

type MarkCommissionPendingType = AuthenticatedMWType & TransactionRequiredParams & SingleForm;

async function markCommissionPending(params: MarkCommissionPendingType): Promise<CommissionDto> {
    const {logger, languageCode, session, _id, actionUserCtx, company} = params;

    logger.start(`Marking commission pending: ${_id}...`);

    const existing = await commissionService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id, status: CommissionStatus.PAID},
        {session, logger, languageCode}
    );

    SchemaGuard.sanitizeFields(Commission, {status: {}}, "write", actionUserCtx, languageCode);

    await commissionService.updateByIdOrThrow(
        existing._id,
        {
            $set: {status: CommissionStatus.PENDING},
            $unset: {paidAt: 1, voidedAt: 1}
        },
        {session, logger, languageCode, auditUserId: actionUserCtx.userId}
    );

    let returnCommission = undefined;
    try {
        const readSanitizedFields = SchemaGuard.sanitizeFields(Commission, COLLECTED_DATA["commissions"].readFields, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(readSanitizedFields, Commission.schema);
        const populatedCommission = await commissionService.findById(
            existing._id,
            {session, logger, languageCode},
            populate.populate
        );
        returnCommission = commissionToDTO(populatedCommission);
    } catch (e) {
        logger.debug("User has no read permission on commission!");
    }

    logger.finish(`Successfully marked commission pending: ${_id}`);
    if (returnCommission === undefined) {
        throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
    }
    return returnCommission;
}

// ── PATCH /requestApproval ────────────────────────────────────────────────────

router.patch(
    "/requestApproval",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(validateSingleForm),
    transactionHandler(),
    asyncHandler(requestCommissionApproval)
);

async function requestCommissionApproval(params: MarkCommissionPendingType): Promise<CommissionDto> {
    const {logger, languageCode, session, _id, actionUserCtx, company} = params;

    logger.start(`Requesting approval for commission: ${_id}...`);
    SchemaGuard.sanitizeFields(Commission, {status: {}}, "write", actionUserCtx, languageCode);

    const existing = await commissionService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id, status: CommissionStatus.PENDING},
        {session, logger, languageCode},
        [{path: "currency", select: "symbol name"}]
    );

    await commissionService.updateByIdOrThrow(
        existing._id,
        {$set: {status: CommissionStatus.PENDING_APPROVAL}},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId}
    );

    emitNotificationEvent(NotificationEventCodes.COMMISSION_PENDING_APPROVAL, {
        receiverIds: [actionUserCtx.userId],
        payload: {
            companyId: company._id.toString(),
            commissionId: existing._id.toString(),
            amount: existing.amount?.toString(),
            currencySymbol: (existing.currency as any)?.symbol,
            sourceType: existing.sourceType,
            sourceId: existing.sourceId?.toString(),
            languageCode: languageCode ?? "en-US",
        },
    });

    let returnCommission: CommissionDto | undefined = undefined;
    try {
        const readSanitizedFields = SchemaGuard.sanitizeFields(Commission, COLLECTED_DATA["commissions"].readFields, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(readSanitizedFields, Commission.schema);
        const populatedCommission = await commissionService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        returnCommission = commissionToDTO(populatedCommission);
    } catch (e) {
        logger.debug("User has no read permission on commission!");
    }

    logger.finish(`Approval requested for commission: ${_id}`);
    if (returnCommission === undefined) {
        throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
    }
    return returnCommission;
}

// ── PATCH /approvePayment ─────────────────────────────────────────────────────

router.patch(
    "/approvePayment",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod((lang) => z.object({
        _id:      z.string().min(1),
        decision: z.enum(["approved", "rejected"]),
        notes:    z.string().optional(),
    })),
    transactionHandler(),
    asyncHandler(approveCommissionPayment)
);

type ApproveCommissionPaymentType = AuthenticatedMWType & TransactionRequiredParams & {
    _id: string; decision: "approved" | "rejected"; notes?: string;
};

async function approveCommissionPayment(params: ApproveCommissionPaymentType): Promise<CommissionDto> {
    const {logger, languageCode, session, _id, decision, notes, actionUserCtx, company} = params;

    logger.start(`Commission payment decision "${decision}" for: ${_id}...`);
    SchemaGuard.sanitizeFields(Commission, {status: {}}, "write", actionUserCtx, languageCode);

    const existing = await commissionService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id, status: CommissionStatus.PENDING_APPROVAL},
        {session, logger, languageCode},
        [{path: "currency", select: "symbol name"}]
    );

    if (decision === "approved") {
        await commissionService.updateByIdOrThrow(
            existing._id,
            {$set: {status: CommissionStatus.PENDING}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId}
        );
    } else {
        await commissionService.updateByIdOrThrow(
            existing._id,
            {$set: {status: CommissionStatus.VOIDED, voidedAt: new Date(), notes: notes ?? existing.notes}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId}
        );
        emitNotificationEvent(NotificationEventCodes.COMMISSION_APPROVAL_REJECTED, {
            receiverIds: [(existing.agent as any)?._id?.toString() ?? existing.agent?.toString()].filter(Boolean) as string[],
            payload: {
                companyId: company._id.toString(),
                commissionId: existing._id.toString(),
                notes,
                languageCode: languageCode ?? "en-US",
            },
        });
    }

    let returnCommission: CommissionDto | undefined = undefined;
    try {
        const readSanitizedFields = SchemaGuard.sanitizeFields(Commission, COLLECTED_DATA["commissions"].readFields, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(readSanitizedFields, Commission.schema);
        const populatedCommission = await commissionService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        returnCommission = commissionToDTO(populatedCommission);
    } catch (e) {
        logger.debug("User has no read permission on commission!");
    }

    logger.finish(`Commission payment ${decision}: ${_id}`);
    if (returnCommission === undefined) {
        throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
    }
    return returnCommission;
}

// ── PATCH /setSplits ──────────────────────────────────────────────────────────

router.patch(
    "/setSplits",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod((lang) => z.object({
        _id: z.string().min(1),
        splits: z.array(z.object({
            agentId:     z.string().min(1),
            label:       z.string().optional(),
            ratePercent: z.number().min(0).max(100),
            amount:      z.number().min(0),
        })).max(20),
    })),
    transactionHandler(),
    asyncHandler(setCommissionSplits)
);

type SetCommissionSplitsType = AuthenticatedMWType & TransactionRequiredParams & {
    _id: string;
    splits: {agentId: string; label?: string; ratePercent: number; amount: number}[];
};

async function setCommissionSplits(params: SetCommissionSplitsType): Promise<CommissionDto> {
    const {logger, languageCode, session, _id, splits, actionUserCtx, company} = params;

    logger.start(`Setting commission splits for: ${_id}...`);
    SchemaGuard.sanitizeFields(Commission, {status: {}}, "write", actionUserCtx, languageCode);

    const existing = await commissionService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode}
    );

    const totalAmount = parseFloat(existing.amount.toString());
    const splitsTotal = splits.reduce((s, sp) => s + sp.amount, 0);
    if (splitsTotal > totalAmount + 0.005) {
        throw apiValidationException("commission_splits_exceed_total", "", null, languageCode);
    }

    const splitDocs = splits.map((sp) => ({
        agent: new ObjectId(sp.agentId),
        label: sp.label?.trim() || undefined,
        ratePercent: sp.ratePercent,
        amount: Decimal128.fromString(sp.amount.toString()),
    }));

    await commissionService.updateByIdOrThrow(
        existing._id,
        splits.length === 0
            ? {$unset: {splits: ""}}
            : {$set: {splits: splitDocs}},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId}
    );

    let returnCommission: CommissionDto | undefined = undefined;
    try {
        const readSanitizedFields = SchemaGuard.sanitizeFields(Commission, COLLECTED_DATA["commissions"].readFields, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(readSanitizedFields, Commission.schema);
        const populatedCommission = await commissionService.findById(
            existing._id,
            {session, logger, languageCode},
            populate.populate
        );
        returnCommission = commissionToDTO(populatedCommission);
    } catch (e) {
        logger.debug("User has no read permission on commission!");
    }

    logger.finish(`Successfully set ${splits.length} split(s) for commission: ${_id}`);
    if (returnCommission === undefined) {
        throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
    }
    return returnCommission;
}
