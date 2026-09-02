import {IRentalPayment} from "../../../database/schemas/rentalPayment/rentalPayment";
import {RentalPayment} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.dto";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleCurrency} from "@coreModule/utilities/mappers/common.mapper";
import {
    lateFeeNumber,
    moneyNumber,
    remainingNumber,
    paidAmountNumber,
} from "@propertyManagement/utilities/lease/rentRemaining";

export function rentalPaymentToDTO(payment: IRentalPayment): RentalPayment {
    const unit  = payment.unit  as any;
    const lease = payment.lease as any;
    const receipts = Array.isArray(payment.paymentReceipts)
        ? payment.paymentReceipts.map((r) => ({
            amount: moneyNumber(r.amount),
            paidDate: r.paidDate ? new Date(r.paidDate).toISOString().split("T")[0] : "",
            ...(r.notes ? {notes: r.notes} : {}),
        }))
        : undefined;
    return {
        _id:      payment._id.toString(),
        name:     payment.name,
        lease:    lease  ? mapPopulatedRef(lease)  : undefined,
        unit:     unit   ? {_id: unit._id?.toString() ?? unit.toString(), name: unit.name, unitNumber: unit.unitNumber} : undefined,
        dueDate:  payment.dueDate ? new Date(payment.dueDate).toISOString().split("T")[0] : "",
        amount:   moneyNumber(payment.amount),
        currency: mapPopulatedSimpleCurrency(payment.currency as any),
        status:   payment.status || undefined,
        paidDate: payment.paidDate   ? new Date(payment.paidDate).toISOString().split("T")[0] : undefined,
        paidAmount: paidAmountNumber(payment),
        remaining: remainingNumber(payment),
        lateFeeAmount: lateFeeNumber(payment),
        paymentReceipts: receipts,
        notes:      payment.notes,
        receiptMedia: payment.receiptMedia ? mapMedia(payment.receiptMedia) : undefined,
        ...mapSoftDeleteToDTO(payment),
        ...mapOwnershipToDTO(payment),
        ...mapLifeCycleToDTO(payment),
    };
}

export function rentalPaymentsToDTO(payments: IRentalPayment[]): RentalPayment[] {
    return payments.map(rentalPaymentToDTO);
}
