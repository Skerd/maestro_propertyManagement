/**
 * Reservations. Active ones move their unit to reserved_unit.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {ReservationSeedRow} from "./types";

export const reservationsSeed: readonly ReservationSeedRow[] = [
    {
        "id": "6a538b10d4b6b1160814e375",
        "unit": "6a5018e588c85ab828431b30",
        "reservedBy": {
            "$user": "echo@echo.com"
        },
        "client": {
            "$user": "eniada.halebi@pronix.com"
        },
        "reservationDate": "2026-07-07T12:39:44.041Z",
        "expirationDate": "2026-08-06T12:39:44.041Z",
        "reservationNotes": "Demo reservation for A0-05 Floor 0. [pm-demo-seed]",
        "depositAmount": "15000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "bank_transfer",
        "source": "agent",
        "paid": true,
        "isActive": true,
        "status": "active",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": null
    },
    {
        "id": "6a538b10d4b6b1160814e376",
        "unit": "6a501b3388c85ab828433c9f",
        "reservedBy": {
            "$user": "skerd@xhafa.com"
        },
        "client": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "reservationDate": "2026-07-10T12:39:44.041Z",
        "expirationDate": "2026-08-09T12:39:44.041Z",
        "reservationNotes": "Demo reservation for A1-01 Floor 1. [pm-demo-seed]",
        "depositAmount": "10000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "bank_transfer",
        "source": "portal",
        "paid": false,
        "isActive": true,
        "status": "active",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": null
    },
    {
        "id": "6a538b10d4b6b1160814e377",
        "unit": "6a5018e588c85ab828431b65",
        "reservedBy": {
            "$user": "eniada.halebi@pronix.com"
        },
        "client": {
            "$user": "almir@leka.com"
        },
        "reservationDate": "2026-07-02T12:39:44.041Z",
        "expirationDate": "2026-08-01T12:39:44.041Z",
        "reservationNotes": "Demo reservation for A1-01 Floor 1. [pm-demo-seed]",
        "depositAmount": "20000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "bank_transfer",
        "source": "walk_in",
        "paid": true,
        "isActive": true,
        "status": "active",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": null
    },
    {
        "id": "6a538b10d4b6b1160814e378",
        "unit": "6a501e2588c85ab8284360da",
        "reservedBy": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "client": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "reservationDate": "2026-05-28T12:39:44.041Z",
        "expirationDate": "2026-07-07T12:39:44.041Z",
        "reservationNotes": "Demo reservation for A1-01 Floor 1. [pm-demo-seed]",
        "depositAmount": "12000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "bank_transfer",
        "source": "referral",
        "paid": true,
        "isActive": false,
        "status": "expired",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": "2026-07-07T12:39:44.041Z"
    },
    {
        "id": "6a538b10d4b6b1160814e379",
        "unit": "6a501b3388c85ab828433cc1",
        "reservedBy": {
            "$user": "almir@leka.com"
        },
        "client": {
            "$user": "echo@echo.com"
        },
        "reservationDate": "2026-06-22T12:39:44.041Z",
        "expirationDate": "2026-07-22T12:39:44.041Z",
        "reservationNotes": "Demo reservation for A1-02 Floor 1. [pm-demo-seed]",
        "depositAmount": "8000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "bank_transfer",
        "source": "social",
        "paid": false,
        "isActive": false,
        "status": "cancelled",
        "cancelledAt": "2026-07-04T12:39:44.041Z",
        "cancellationReason": "Client withdrew interest",
        "expiredAt": null
    },
    {
        "id": "6a538b10d4b6b1160814e37a",
        "unit": "6a501f4c88c85ab828436aaf",
        "reservedBy": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "client": {
            "$user": "skerd@xhafa.com"
        },
        "reservationDate": "2026-06-12T12:39:44.041Z",
        "expirationDate": "2026-07-17T12:39:44.041Z",
        "reservationNotes": "Demo reservation for A1-02 Floor 1. [pm-demo-seed]",
        "depositAmount": "25000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "bank_transfer",
        "source": "agent",
        "paid": true,
        "isActive": false,
        "status": "converted",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": null
    }
];
