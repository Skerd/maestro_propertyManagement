import {IReservation} from "../../../database/schemas/reservation/reservation";
import {Reservation} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.dto";
import type {CompanyBlank} from "armonia/src/modules/core/dto/company.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSale} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CompanyBlankSnippet} from "@coreModule/database/schemas/company/company.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {FloorSimpleSnippet} from "@propertyManagement/database/schemas/floor/floor.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSaleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";

function computeReservationFinancialFields(reservation: IReservation): Pick<Reservation, "remainingBalance" | "reservationFinancialPaymentState"> {
    const paid = reservation.paid === true;
    const unit = reservation.unit as {
        price?: {toString(): string} | number;
        priceCurrency?: {_id?: {toString(): string}; toString?: () => string};
    };
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
        const unitCurId =
            unit?.priceCurrency?._id?.toString() ??
            (typeof unit?.priceCurrency === "object" ? unit?.priceCurrency?.toString?.() : undefined);
        const depCur = reservation.depositCurrency as {_id?: {toString(): string}; toString?: () => string} | undefined;
        const depCurId =
            depCur && typeof depCur === "object" && depCur._id
                ? depCur._id.toString()
                : depCur?.toString?.();

        const sameCurrency = !depCurId || !unitCurId || depCurId === unitCurId;

        if (sameCurrency) {
            remainingBalance = Math.max(0, unitPrice - deposit);
        }
    }

    return {remainingBalance, reservationFinancialPaymentState};
}

export function reservationToDTO(reservation: IReservation): Reservation {
    const unit = reservation.unit as {floor?: {edifice?: {project?: object} & object} & object} | undefined;
    return {
        _id: reservation._id.toString(),
        name: reservation.name || undefined,
        unit: mapSnippet<UnitSale>()(reservation.unit, UnitSaleSnippet)
            ?? {_id: String((reservation.unit as {_id?: {toString(): string}})?._id ?? reservation.unit)},
        project: unit?.floor?.edifice?.project
            ? mapSnippet<ProjectSimple>()(unit.floor.edifice.project, ProjectSimpleSnippet)
            : undefined,
        edifice: unit?.floor?.edifice
            ? mapSnippet<EdificeSimple>()(unit.floor.edifice, EdificeSimpleSnippet)
            : undefined,
        floor: unit?.floor
            ? mapSnippet<FloorSimple>()(unit.floor, FloorSimpleSnippet)
            : undefined,
        reservedBy: mapSnippet<SimpleBlankUser>()(reservation.reservedBy, SimpleBlankUserSnippet)!,
        reservedByCompany: mapSnippet<CompanyBlank>()(reservation.reservedByCompany, CompanyBlankSnippet)!,
        client: mapSnippet<SimpleBlankUser>()(reservation.client, SimpleBlankUserSnippet)!,
        reservationDate: reservation.reservationDate ? new Date(reservation.reservationDate).toISOString() : undefined,
        expirationDate: reservation.expirationDate ? new Date(reservation.expirationDate).toISOString() : undefined,
        reservationNotes: reservation.reservationNotes || undefined,
        depositAmount: reservation.depositAmount ? parseFloat(reservation.depositAmount.toString()) : undefined,
        depositCurrency: mapSnippet<CurrencySimple>()(reservation.depositCurrency, CurrencySimpleSnippet),
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
