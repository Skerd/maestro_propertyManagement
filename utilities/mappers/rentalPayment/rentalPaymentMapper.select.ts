import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalPayment} from "../../../database/schemas/rentalPayment/rentalPayment";

export function rentalPaymentToSelect(payment: IRentalPayment): ApiSelectDatum {
    const label = payment.name ?? payment._id.toString();
    return {
        value: payment._id.toString(),
        label,
    };
}

export function rentalPaymentsToSelect(payments: IRentalPayment[]): ApiSelectDatum[] {
    return payments.map(rentalPaymentToSelect);
}
