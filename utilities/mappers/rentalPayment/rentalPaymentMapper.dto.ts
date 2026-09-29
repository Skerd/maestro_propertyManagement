import {IRentalPayment} from "../../../database/schemas/rentalPayment/rentalPayment";
import {RentalPayment} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {LeaseSimple} from "armonia/src/modules/propertyManagement/dto/lease.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {LeaseSimpleSnippet} from "@propertyManagement/database/schemas/lease/lease.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    lateFeeNumber,
    moneyNumber,
    remainingNumber,
    paidAmountNumber,
} from "@propertyManagement/utilities/lease/rentRemaining";

export function rentalPaymentToDTO(payment: IRentalPayment): RentalPayment {
    const currency = mapSnippet<CurrencySimple>()(payment.currency, CurrencySimpleSnippet);
    const receipts = Array.isArray(payment.paymentReceipts)
        ? payment.paymentReceipts.map((r) => ({
            amount: moneyNumber(r.amount),
            paidDate: r.paidDate ? new Date(r.paidDate).toISOString().split("T")[0] : "",
            ...(r.notes ? {notes: r.notes} : {}),
            ...(currency ? {currency} : {}),
            ...(r.media?.length ? {media: r.media.map(mapMedia)} : {}),
        }))
        : undefined;
    return {
        _id:      payment._id.toString(),
        name:     payment.name,
        lease:    mapSnippet<LeaseSimple>()(payment.lease, LeaseSimpleSnippet),
        unit:     mapSnippet<UnitSimple>()(payment.unit, UnitSimpleSnippet),
        dueDate:  payment.dueDate ? new Date(payment.dueDate).toISOString().split("T")[0] : "",
        amount:   moneyNumber(payment.amount),
        currency,
        status:   payment.status || undefined,
        paidDate: payment.paidDate   ? new Date(payment.paidDate).toISOString().split("T")[0] : undefined,
        paidAmount: paidAmountNumber(payment),
        remaining: remainingNumber(payment),
        lateFeeAmount: lateFeeNumber(payment),
        paymentReceipts: receipts,
        paymentReceiptsMedia: receipts?.flatMap((r) => r.media ?? []),
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
