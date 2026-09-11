import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {terminateLeaseFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/terminateLease.form.validator";
import {returnDepositFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/returnDeposit.form.validator";
import {recordRentPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/recordRentPayment.form.validator";
import {sendRentReminderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/sendRentReminder.form.validator";
import type {Lease as LeaseData} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.dto";
import {leaseToDTO} from "@propertyManagement/utilities/mappers/lease/leaseMapper.dto";
import {
    releaseUnitIfRented,
    unitIdFromLease,
    waiveOpenRentalPayments,
} from "@propertyManagement/utilities/lease/leaseLifecycle";
import {resyncLeaseSchedule} from "@propertyManagement/utilities/lease/leaseScheduleResync";
import {
    applyRentalPaymentSlice,
    decimal128FromNumber,
    OPEN_RENT_STATUSES,
    planFifoSlices,
} from "@propertyManagement/utilities/lease/rentRemaining";
import {rentalPaymentService} from "../rentalPayment/rentalPayment.service";
import Lease, {LeaseStatus} from "./lease";
import {leaseService} from "./lease.service";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {RENTAL_PAYMENT_RECEIPT_MEDIA_MAX} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {
    sendManualRentReminder,
} from "@propertyManagement/utilities/database/lease/leaseClientEmailDispatch";
import {
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";

async function loadLeaseForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return leaseService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnLeaseDto(leaseId: any, params: Record<string, any>): Promise<LeaseData | undefined> {
    const {logger, languageCode, session, actionUserCtx} = params;
    try {
        const readFields = SchemaGuard.sanitizeFields(
            Lease,
            getModelCollectedData("leases").readFields!,
            "read",
            actionUserCtx,
            languageCode,
        );
        const populate = SchemaGuard.generatePopulate(readFields, Lease.schema);
        const updated = await leaseService.findById(leaseId, {session, logger, languageCode}, populate.populate, populate.select);
        if (updated) return leaseToDTO(updated);
    } catch {
        logger.debug("User has no read permission on lease after action");
    }
    return undefined;
}

export class LeaseActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      terminateLeaseFormSchema,
    })
    async terminate(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, terminationReason, terminationDate} = params;

        logger.start(`Terminating lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (existing.status !== LeaseStatus.ACTIVE) {
            throw apiValidationException("lease_not_active", "", null, languageCode);
        }

        const endedAt = terminationDate ? new Date(terminationDate) : new Date();
        await leaseService.updateByIdOrThrow(
            existing._id,
            {
                $set: {
                    status: LeaseStatus.TERMINATED,
                    terminationDate: endedAt,
                    ...(terminationReason != null && terminationReason !== ""
                        ? {terminationReason: String(terminationReason).trim()}
                        : {}),
                },
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const ctx = {session, logger, languageCode, actionUserCtx, company};
        await waiveOpenRentalPayments(existing._id, ctx);
        const unitId = unitIdFromLease(existing);
        if (unitId) await releaseUnitIfRented(unitId, ctx);

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Terminated lease ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      validateSingleForm,
    })
    async markDepositPaid(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id} = params;

        logger.start(`Marking deposit paid for lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (existing.depositPaid) {
            throw apiValidationException("lease_deposit_already_paid", "", null, languageCode);
        }

        await leaseService.updateByIdOrThrow(
            existing._id,
            {$set: {depositPaid: true}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Marked deposit paid for lease ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      returnDepositFormSchema,
    })
    async returnDeposit(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, depositReturnedAt} = params;

        logger.start(`Returning deposit for lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (!existing.depositPaid) {
            throw apiValidationException("lease_deposit_not_paid", "", null, languageCode);
        }
        if (existing.depositReturnedAt) {
            throw apiValidationException("lease_deposit_already_returned", "", null, languageCode);
        }

        const returnedAt = depositReturnedAt ? new Date(depositReturnedAt) : new Date();
        await leaseService.updateByIdOrThrow(
            existing._id,
            {$set: {depositReturnedAt: returnedAt}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Returned deposit for lease ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        middleware:  [mediaUploadMW({maxFiles: RENTAL_PAYMENT_RECEIPT_MEDIA_MAX, maxFileSize: 25 * 1024 * 1024})],
        schema:      recordRentPaymentFormSchema,
    })
    async recordRentPayment(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, paidAmount, paidDate, notes, fileIds} = params;

        logger.start(`Recording lease rent payment ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (existing.status !== LeaseStatus.ACTIVE) {
            throw apiValidationException("lease_not_active", "", null, languageCode);
        }

        const openMonths = await rentalPaymentService.find(
            {
                lease: existing._id,
                company: company._id,
                status: {$in: [...OPEN_RENT_STATUSES]},
            },
            {session, logger, languageCode, withDeleted: false},
            [],
            undefined,
            {dueDate: 1},
        );

        const plan = planFifoSlices(
            openMonths.map((row) => ({
                id: row._id.toString(),
                amount: row.amount,
                paidAmount: row.paidAmount,
                lateFeeAmount: row.lateFeeAmount,
                status: row.status,
                paymentReceipts: row.paymentReceipts,
            })),
            decimal128FromNumber(paidAmount),
        );
        if (!plan.ok) {
            throw apiValidationException(
                plan.reason === "no_open_due" ? "rental_payment_no_open_due" : "rental_payment_exceeds_open_due",
                "",
                null,
                languageCode,
            );
        }

        const paidAt = paidDate ? new Date(paidDate) : new Date();
        const byId = new Map(openMonths.map((row) => [row._id.toString(), row]));
        for (const slice of plan.slices) {
            const row = byId.get(slice.id);
            if (!row) continue;
            const applied = applyRentalPaymentSlice(row, {
                paidAmount: slice.slice,
                paidDate: paidAt,
                notes,
                media: fileIds,
            });
            if (!applied.ok) {
                throw apiValidationException("rental_payment_overpay", "", null, languageCode);
            }
            const $set: Record<string, unknown> = {
                paidAmount: applied.paidAmount,
                status: applied.status,
                paymentReceipts: applied.paymentReceipts,
            };
            if (applied.paidDate) $set.paidDate = applied.paidDate;
            await rentalPaymentService.updateByIdOrThrow(
                row._id,
                {$set},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Recorded lease rent payment ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      validateSingleForm,
    })
    async resyncSchedule(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;

        logger.start(`Resyncing rent schedule for lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        await resyncLeaseSchedule(existing, existing, {session, logger, languageCode, actionUserCtx, company});

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Resynced rent schedule for lease ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      sendRentReminderFormSchema,
    })
    async sendRentReminder(params: Record<string, any>): Promise<{ok: true}> {
        const {logger, languageCode, session, company, _id, rentalPaymentId, kind} = params;

        logger.start(`Sending rent reminder ${kind} for lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (existing.status !== LeaseStatus.ACTIVE) {
            throw apiValidationException("lease_not_active", "", null, languageCode);
        }

        const payment = await rentalPaymentService.findOneOrThrow(
            {_id: new ObjectId(rentalPaymentId), lease: existing._id, company: company._id},
            {session, logger, languageCode},
            [
                {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
                {path: "currency", select: "symbol"},
            ],
        );

        const companyName = typeof company.name === "string" ? company.name : "";
        await sendManualRentReminder({
            lease: existing,
            payment,
            kind,
            languageCode: languageCode ?? "en-US",
            companyId: company._id.toString(),
            companyName,
            session,
        });

        logger.finish(`Sent rent reminder ${kind} for lease ${_id}`);
        return {ok: true};
    }
}
