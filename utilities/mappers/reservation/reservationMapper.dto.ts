import {IReservation} from "../../../database/schemas/reservation/reservation";
import {Reservation} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.dto";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {
    mapMedia,
    mapPopulatedRef,
    mapPopulatedSimpleCompany,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";

function mapUnitRef(unit: any): Reservation["unit"] | undefined {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() || unit.toString(),
        name: unit.name,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType ? {
            _id: unit.unitType._id?.toString() || unit.unitType.toString(),
            name: unit.unitType.name,
            icon: unit.unitType.icon
        } : undefined,
        price: unit.price != null ? parseFloat(unit.price.toString()) : undefined,
        priceCurrency: unit.priceCurrency ? mapPopulatedSimpleCurrency(unit.priceCurrency) : undefined,
    };
}

function computeReservationFinancialFields(reservation: IReservation): Pick<Reservation, "remainingBalance" | "reservationFinancialPaymentState"> {
    const paid = reservation.paid === true;
    const unit = reservation.unit as any;
    const unitPrice =
        unit?.price != null && Number.isFinite(parseFloat(unit.price.toString()))
            ? parseFloat(unit.price.toString())
            : undefined;
    const deposit =
        reservation.depositAmount != null
            ? parseFloat(reservation.depositAmount.toString())
            : 0;

    let reservationFinancialPaymentState: Reservation["reservationFinancialPaymentState"];
    if (paid) {
        reservationFinancialPaymentState = "fullyPaid";
    } else if (deposit > 0) {
        reservationFinancialPaymentState = "partiallyPaid";
    } else {
        reservationFinancialPaymentState = "unpaid";
    }

    let remainingBalance: number | undefined;
    if (unitPrice != null && Number.isFinite(unitPrice)) {
        // if (paid) {
        //     remainingBalance = 0;
        // } else {
            const unitCurId =
                unit?.priceCurrency?._id?.toString() ??
                (typeof unit?.priceCurrency === "object" ? unit?.priceCurrency?.toString?.() : undefined);
            const depCur = reservation.depositCurrency as any;
            const depCurId =
                depCur && typeof depCur === "object" && depCur._id
                    ? depCur._id.toString()
                    : depCur?.toString?.();

            const sameCurrency = !depCurId || !unitCurId || depCurId === unitCurId;

            if (sameCurrency) {
                remainingBalance = Math.max(0, unitPrice - deposit);
            }
        // }
    }

    return {remainingBalance, reservationFinancialPaymentState};
}

export function reservationToDTO(reservation: IReservation): Reservation {
    return {
        _id: reservation._id.toString(),
        name: reservation.name || undefined,
        unit: mapUnitRef(reservation.unit) || { _id: reservation.unit?.toString() || '' },
        project: mapPopulatedRef(reservation.unit?.floor?.edifice?.project),
        edifice: mapPopulatedRef(reservation.unit?.floor?.edifice),
        floor: mapPopulatedRef(reservation.unit?.floor),
        reservedBy: mapPopulatedSimpleUser(reservation.reservedBy),
        reservedByCompany: mapPopulatedSimpleCompany(reservation.reservedByCompany),
        client: mapPopulatedSimpleUser(reservation.client),
        reservationDate: reservation.reservationDate ? new Date(reservation.reservationDate).toISOString() : undefined,
        expirationDate: reservation.expirationDate ? new Date(reservation.expirationDate).toISOString() : undefined,
        reservationNotes: reservation.reservationNotes || undefined,
        depositAmount: reservation.depositAmount ? parseFloat(reservation.depositAmount.toString()) : undefined,
        depositCurrency: mapPopulatedSimpleCurrency(reservation.depositCurrency),
        isActive: reservation.isActive !== undefined ? reservation.isActive : true,
        cancelledAt: reservation.cancelledAt ? new Date(reservation.cancelledAt).toISOString() : undefined,
        cancellationReason: reservation.cancellationReason,
        paid: reservation.paid,
        paymentMethod: reservation.paymentMethod || undefined,
        reservationContract: reservation.reservationContract?.length ? reservation.reservationContract.map((m) => mapMedia(m)) : undefined,
        additionalDocuments: reservation.additionalDocuments?.length ? reservation.additionalDocuments.map((m) => mapMedia(m)) : undefined,
        ...computeReservationFinancialFields(reservation),
        confirmationEmailSentAt: reservation.confirmationEmailSentAt? new Date(reservation.confirmationEmailSentAt).toISOString() : undefined,
        expirationReminderEmailAt3d: reservation.expirationReminderEmailAt3d ? new Date(reservation.expirationReminderEmailAt3d).toISOString() : undefined,
        expirationReminderEmailAt1d: reservation.expirationReminderEmailAt1d ? new Date(reservation.expirationReminderEmailAt1d).toISOString() : undefined,
        expirationReminderEmailAt0d: reservation.expirationReminderEmailAt0d ? new Date(reservation.expirationReminderEmailAt0d).toISOString() : undefined,
        expiredAt: reservation.expiredAt ? new Date(reservation.expiredAt).toISOString() : undefined,
        status: reservation.status,
        ...mapSoftDeleteToDTO(reservation),
        ...mapOwnershipToDTO(reservation),
        ...mapLifeCycleToDTO(reservation)
    };
}

export function reservationsToDTO(reservations: IReservation[]): Reservation[] {
    return reservations.map(reservationToDTO);
}
