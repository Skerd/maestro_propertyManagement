import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IReservation} from "../../../database/schemas/reservation/reservation";

export function reservationToSelect(reservation: IReservation): ApiSelectDatum {
    let label = "";

    if (reservation.name) {
        label = reservation.name;
    }

    if (reservation.client) {
        const client = reservation.client as {name?: string; surname?: string};
        const clientLabel = [client.name, client.surname].filter(Boolean).join(" ").trim();
        if (clientLabel) {
            label = label ? `${label} — ${clientLabel}` : clientLabel;
        }
    }

    if (reservation.unit) {
        const unit = reservation.unit as {name?: string; unitNumber?: string};
        let unitLabel = "";
        if (unit.unitNumber) {
            unitLabel = unit.unitNumber;
        }
        if (unit.name && unitLabel) {
            unitLabel += ` - ${unit.name}`;
        } else if (unit.name) {
            unitLabel = unit.name;
        }
        if (unitLabel) {
            label = label ? `${label} [${unitLabel}]` : unitLabel;
        }
    }

    if (reservation.reservationDate) {
        const d = new Date(reservation.reservationDate as Date).toLocaleDateString();
        label = label ? `${label} (${d})` : d;
    }

    if (!label) {
        label = reservation._id.toString();
    }

    return {
        value: reservation._id.toString(),
        label,
    };
}

export function reservationsToSelect(reservations: IReservation[]): ApiSelectDatum[] {
    return reservations.map((r) => reservationToSelect(r));
}
