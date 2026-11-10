import {ObjectId} from "mongodb";
import {sumMinor, toMinor} from "armonia/src/modules/core/helpers/money";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {action} from "@coreModule/api/actionDecorator";
import {COLLECTED_DATA} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {SingleForm} from "armonia/src/modules/core/types/shared.types";
import type {ApproveCommissionPaymentForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/approveCommissionPayment.form.type";
import {approveCommissionPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/approveCommissionPayment.form.validator";
import type {Commission as CommissionDto} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/commission.dto";
import type {MarkCommissionPaidForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/markCommissionPaid.form.type";
import {markCommissionPaidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/markCommissionPaid.form.validator";
import type {SetCommissionSplitsForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/setCommissionSplits.form.type";
import {setCommissionSplitsFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/setCommissionSplits.form.validator";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {companyMemberIdsWithPermission} from "@coreModule/domain/roles/companyPermissionHolders";
import {actionPermissionTag} from "@coreModule/utilities/security/actionPermissions";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {commissionToDTO} from "../../../utilities/mappers/commission/commissionMapper.dto";
import Commission, {CommissionStatus} from "./commission";
import {commissionService} from "./commission.service";

export class CommissionActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: markCommissionPaidFormSchema,
    })
    async markPaid(params: Record<string, any>): Promise<CommissionDto> {
        const {logger, languageCode, session, _id, actionUserCtx, company, paymentReference, paymentReceiptMediaId} =
            params as Record<string, any> & MarkCommissionPaidForm;

        logger.start(`Marking commission paid: ${_id}...`);


        const existing = await commissionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
            [{path: "currency", select: "symbol name"}]
        );
        // Paying goes through approval: pending → requestApproval → approvePayment → paid.
        if (existing.status !== CommissionStatus.APPROVED) {
            throw apiValidationException("commission_not_approved", "", null, languageCode);
        }

        const paidSetFields: Record<string, unknown> = {
            status: CommissionStatus.PAID,
            paidAt: new Date(),
        };
        if (paymentReference) paidSetFields.paymentReference = paymentReference;
        if (paymentReceiptMediaId) paidSetFields.paymentReceiptMediaId = new ObjectId(paymentReceiptMediaId);

        await commissionService.updateByIdOrThrow(
            existing._id,
            {$set: paidSetFields},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId}
        );

        const agentId = existing.agent?._id?.toString() ?? existing.agent?.toString();
        if (agentId) {
            emitNotificationEvent(NotificationEventCodes.COMMISSION_PAID, {
                receiverIds: [agentId],
                payload: {
                    companyId: company._id.toString(),
                    commissionId: existing._id.toString(),
                    amount: existing.amount?.toString(),
                    currencyId: existing.currency?._id?.toString() ?? existing.currency?.toString(),
                    currencySymbol: existing.currency?.symbol,
                    sourceType: existing.sourceType,
                    sourceId: existing.sourceId?.toString(),
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        const returnCommission = await this.reloadCommissionDto(existing._id, params);
        logger.finish(`Successfully marked commission paid: ${_id}`);
        if (returnCommission === undefined) {
            throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
        }
        return returnCommission;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async markPending(params: Record<string, any>): Promise<CommissionDto> {
        const {logger, languageCode, session, _id, actionUserCtx, company} =
            params as Record<string, any> & SingleForm;

        logger.start(`Marking commission pending: ${_id}...`);

        const existing = await commissionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id, status: CommissionStatus.PAID},
            {session, logger, languageCode}
        );


        await commissionService.updateByIdOrThrow(
            existing._id,
            {
                $set: {status: CommissionStatus.PENDING},
                $unset: {paidAt: 1, voidedAt: 1}
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId}
        );

        const returnCommission = await this.reloadCommissionDto(existing._id, params);
        logger.finish(`Successfully marked commission pending: ${_id}`);
        if (returnCommission === undefined) {
            throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
        }
        return returnCommission;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async requestApproval(params: Record<string, any>): Promise<CommissionDto> {
        const {logger, languageCode, session, _id, actionUserCtx, company} =
            params as Record<string, any> & SingleForm;

        logger.start(`Requesting approval for commission: ${_id}...`);

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

        // Whoever may approve commission payments hears about it, not the user who just asked (TD-B149).
        const approverIds = (await companyMemberIdsWithPermission(company._id, actionPermissionTag(Commission, "approvePayment", "self")))
            .filter((id) => id !== String(actionUserCtx.userId));
        emitNotificationEvent(NotificationEventCodes.COMMISSION_PENDING_APPROVAL, {
            receiverIds: approverIds,
            payload: {
                companyId: company._id.toString(),
                commissionId: existing._id.toString(),
                amount: existing.amount?.toString(),
                currencySymbol: existing.currency?.symbol,
                sourceType: existing.sourceType,
                sourceId: existing.sourceId?.toString(),
                languageCode: languageCode ?? "en-US",
            },
        });

        const returnCommission = await this.reloadCommissionDto(existing._id, params);
        logger.finish(`Approval requested for commission: ${_id}`);
        if (returnCommission === undefined) {
            throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
        }
        return returnCommission;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: approveCommissionPaymentFormSchema,
    })
    async approvePayment(params: Record<string, any>): Promise<CommissionDto> {
        const {logger, languageCode, session, _id, decision, notes, actionUserCtx, company} =
            params as Record<string, any> & ApproveCommissionPaymentForm;

        logger.start(`Commission payment decision "${decision}" for: ${_id}...`);

        const existing = await commissionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id, status: CommissionStatus.PENDING_APPROVAL},
            {session, logger, languageCode},
            [{path: "currency", select: "symbol name"}]
        );

        if (decision === "approved") {
            await commissionService.updateByIdOrThrow(
                existing._id,
                {$set: {status: CommissionStatus.APPROVED}},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId}
            );
        } else {
            await commissionService.updateByIdOrThrow(
                existing._id,
                {$set: {status: CommissionStatus.VOIDED, voidedAt: new Date(), notes: notes ?? existing.notes}},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId}
            );
            const rejectedAgentId = existing.agent?._id?.toString() ?? existing.agent?.toString();
            emitNotificationEvent(NotificationEventCodes.COMMISSION_APPROVAL_REJECTED, {
                receiverIds: rejectedAgentId ? [rejectedAgentId] : [],
                payload: {
                    companyId: company._id.toString(),
                    commissionId: existing._id.toString(),
                    notes,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        const returnCommission = await this.reloadCommissionDto(existing._id, params);
        logger.finish(`Commission payment ${decision}: ${_id}`);
        if (returnCommission === undefined) {
            throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
        }
        return returnCommission;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: setCommissionSplitsFormSchema,
    })
    async setSplits(params: Record<string, any>): Promise<CommissionDto> {
        const {logger, languageCode, session, _id, splits, actionUserCtx, company} =
            params as Record<string, any> & SetCommissionSplitsForm;

        logger.start(`Setting commission splits for: ${_id}...`);

        const existing = await commissionService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
            [{path: "currency", select: "decimalPlaces"}]
        );

        const decimals = existing.currency?.decimalPlaces;
        const splitMinors = splits.map((sp) => toMinor(sp.amount, decimals));
        if (sumMinor(splitMinors) > toMinor(existing.amount, decimals)) {
            throw apiValidationException("commission_splits_exceed_total", "", null, languageCode);
        }

        const splitDocs = splits.map((sp, index) => ({
            agent: new ObjectId(sp.agentId),
            label: sp.label?.trim() || undefined,
            ratePercent: sp.ratePercent,
            amount: decimal128FromMinor(splitMinors[index], decimals),
        }));

        await commissionService.updateByIdOrThrow(
            existing._id,
            splits.length === 0
                ? {$unset: {splits: ""}}
                : {$set: {splits: splitDocs}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId}
        );

        const returnCommission = await this.reloadCommissionDto(existing._id, params);
        logger.finish(`Successfully set ${splits.length} split(s) for commission: ${_id}`);
        if (returnCommission === undefined) {
            throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
        }
        return returnCommission;
    }

    private async reloadCommissionDto(commissionId: ObjectId, params: Record<string, any>): Promise<CommissionDto | undefined> {
        const {logger, languageCode, session, actionUserCtx} = params;
        try {
            const readSanitizedFields = SchemaGuard.sanitizeFields(
                Commission,
                COLLECTED_DATA["commissions"].readFields,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readSanitizedFields, Commission.schema);
            const populatedCommission = await commissionService.findById(
                commissionId,
                {session, logger, languageCode},
                populate.populate,
            );
            if (populatedCommission) return commissionToDTO(populatedCommission);
        } catch {
            logger.debug("User has no read permission on commission!");
        }
        return undefined;
    }
}
