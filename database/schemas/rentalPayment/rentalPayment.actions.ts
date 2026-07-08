import {Decimal128, ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {markRentalPaymentPaidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/markRentalPaymentPaid.form.validator";
import type {RentalPayment as RentalPaymentData} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.dto";
import {rentalPaymentToDTO} from "@propertyManagement/utilities/mappers/rentalPayment/rentalPaymentMapper.dto";
import RentalPayment, {RentalPaymentStatus} from "./rentalPayment";
import {rentalPaymentService} from "./rentalPayment.service";

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

export class RentalPaymentActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      markRentalPaymentPaidFormSchema,
    })
    async markPaid(params: Record<string, any>): Promise<RentalPaymentData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, paidAmount, paidDate, notes} = params;

        logger.start(`Marking rental payment ${_id} as paid...`);

        const existing = await loadPaymentForAction(params);
        const status = existing.status ?? RentalPaymentStatus.PENDING;
        if (status === RentalPaymentStatus.PAID) {
            throw apiValidationException("rental_payment_already_paid", "", null, languageCode);
        }
        if (status === RentalPaymentStatus.WAIVED) {
            throw apiValidationException("rental_payment_waived", "", null, languageCode);
        }

        const amountDue = existing.amount != null ? parseFloat(existing.amount.toString()) : 0;
        const amountPaid = paidAmount != null ? Number(paidAmount) : amountDue;
        if (!Number.isFinite(amountPaid) || amountPaid < 0) {
            throw apiValidationException("rental_payment_invalid_amount", "", null, languageCode);
        }

        const paidAt = paidDate ? new Date(paidDate) : new Date();
        const $set: Record<string, unknown> = {
            status: RentalPaymentStatus.PAID,
            paidDate: paidAt,
            paidAmount: Decimal128.fromString(String(amountPaid)),
        };
        if (notes !== undefined) $set.notes = notes;

        await rentalPaymentService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnPaymentDto(existing._id, params);
        logger.finish(`Marked rental payment ${_id} as paid`);
        return returnData;
    }
}
