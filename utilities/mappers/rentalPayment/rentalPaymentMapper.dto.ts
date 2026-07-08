import {IRentalPayment} from "../../../database/schemas/rentalPayment/rentalPayment";
import {RentalPayment} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.dto";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleCurrency} from "@coreModule/utilities/mappers/common.mapper";

export function rentalPaymentToDTO(payment: IRentalPayment): RentalPayment {
    const unit  = payment.unit  as any;
    const lease = payment.lease as any;
    return {
        _id:      payment._id.toString(),
        name:     payment.name,
        lease:    lease  ? mapPopulatedRef(lease)  : undefined,
        unit:     unit   ? {_id: unit._id?.toString() ?? unit.toString(), name: unit.name, unitNumber: unit.unitNumber} : undefined,
        dueDate:  payment.dueDate ? new Date(payment.dueDate).toISOString().split("T")[0] : "",
        amount:   payment.amount  != null ? parseFloat(payment.amount.toString())     : 0,
        currency: mapPopulatedSimpleCurrency(payment.currency as any),
        status:   payment.status || undefined,
        paidDate: payment.paidDate   ? new Date(payment.paidDate).toISOString().split("T")[0] : undefined,
        paidAmount: payment.paidAmount != null ? parseFloat(payment.paidAmount.toString()) : undefined,
        notes:      payment.notes,
        receiptMedia: payment.receiptMedia ? mapMedia(payment.receiptMedia) : undefined,
        ...mapSoftDeleteToDTO(payment),
        ...mapOwnershipToDTO(payment),
    };
}

export function rentalPaymentsToDTO(payments: IRentalPayment[]): RentalPayment[] {
    return payments.map(rentalPaymentToDTO);
}
