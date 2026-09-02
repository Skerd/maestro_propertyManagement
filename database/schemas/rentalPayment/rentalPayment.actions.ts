import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {LeaseStatus} from "../lease/lease";
import {leaseService} from "../lease/lease.service";
import RentalPayment, {RentalPaymentStatus, type IRentalPayment} from "./rentalPayment";
import {rentalPaymentService} from "./rentalPayment.service";
import {
    applyRentalPaymentSlice,
    decimal128FromNumber,
    isOpenRentStatus,
} from "@propertyManagement/utilities/lease/rentRemaining";
import {markRentalPaymentPaidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/markRentalPaymentPaid.form.validator";
import {waiveRentalPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/waiveRentalPayment.form.validator";
import type {RentalPayment as RentalPaymentData} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.dto";
import {rentalPaymentToDTO} from "@propertyManagement/utilities/mappers/rentalPayment/rentalPaymentMapper.dto";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";

async function loadPaymentForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return rentalPaymentService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnPaymentDto(paymentId: any, params: Record<string, any>): Promise<RentalPaymentData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(
            getModelCollectedData("rentalpayments").readFields!,
            RentalPayment.schema,
        );
        const updated = await rentalPaymentService.findById(paymentId, {session, logger, languageCode}, populate.populate);
        if (updated) return rentalPaymentToDTO(updated);
    } catch {
        logger.debug("User has no read permission on rental payment after action");
    }
    return undefined;
}

async function assertParentLeaseActive(payment: IRentalPayment, params: Record<string, any>): Promise<void> {
    const {logger, languageCode, session, company} = params;
    const leaseId = (payment.lease as any)?._id ?? payment.lease;
    const lease = await leaseService.findOneOrThrow(
        {_id: new ObjectId(leaseId.toString()), company: company._id},
        {session, logger, languageCode},
    );
    if (lease.status !== LeaseStatus.ACTIVE) {
        throw apiValidationException("lease_not_active", "", null, languageCode);
    }
}

export class RentalPaymentActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      markRentalPaymentPaidFormSchema,
    })
    async markPaid(params: Record<string, any>): Promise<RentalPaymentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, paidAmount, paidDate, notes} = params;

        logger.start(`Recording rental payment ${_id}...`);

        const existing = await loadPaymentForAction(params);
        await assertParentLeaseActive(existing, params);

        const status = existing.status ?? RentalPaymentStatus.PENDING;
        if (status === RentalPaymentStatus.PAID) {
            throw apiValidationException("rental_payment_already_paid", "", null, languageCode);
        }
        if (status === RentalPaymentStatus.WAIVED) {
            throw apiValidationException("rental_payment_waived", "", null, languageCode);
        }
        if (!isOpenRentStatus(status)) {
            throw apiValidationException("rental_payment_already_paid", "", null, languageCode);
        }

        const paidAt = paidDate ? new Date(paidDate) : new Date();
        const applied = applyRentalPaymentSlice(existing, {
            paidAmount: decimal128FromNumber(paidAmount),
            paidDate: paidAt,
            notes,
        });
        if (!applied.ok) {
            throw apiValidationException(
                applied.reason === "not_open" ? "rental_payment_already_paid" : "rental_payment_overpay",
                "",
                null,
                languageCode,
            );
        }

        const $set: Record<string, unknown> = {
            paidAmount: applied.paidAmount,
            status: applied.status,
            paymentReceipts: applied.paymentReceipts,
        };
        if (applied.paidDate) $set.paidDate = applied.paidDate;
        if (notes !== undefined) $set.notes = notes;

        await rentalPaymentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPaymentDto(existing._id, params);
        logger.finish(`Recorded rental payment ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      waiveRentalPaymentFormSchema,
    })
    async waive(params: Record<string, any>): Promise<RentalPaymentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, notes} = params;

        logger.start(`Waiving rental payment ${_id}...`);

        const existing = await loadPaymentForAction(params);
        const status = existing.status ?? RentalPaymentStatus.PENDING;
        if (status === RentalPaymentStatus.PAID) {
            throw apiValidationException("rental_payment_already_paid", "", null, languageCode);
        }
        if (status === RentalPaymentStatus.WAIVED) {
            throw apiValidationException("rental_payment_waived", "", null, languageCode);
        }
        if (!isOpenRentStatus(status)) {
            throw apiValidationException("rental_payment_already_paid", "", null, languageCode);
        }

        const $set: Record<string, unknown> = {status: RentalPaymentStatus.WAIVED};
        if (notes !== undefined) $set.notes = notes;

        await rentalPaymentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPaymentDto(existing._id, params);
        logger.finish(`Waived rental payment ${_id}`);
        return returnData;
    }
}
