/**
 * Reservations. Active ones move their unit to reserved_unit.
 *
 * GENERATED from the live database by the Phase 2 export, then curated (TD-B206): the
 * clients are the demo clients in `demoClients.ts`, and every reservation but the
 * converted one counts its days from the seed day (`{$day}`), so the active ones stay
 * active and the expired and cancelled ones stay in the past.
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
            "$user": "elira.daka@example.com"
        },
        "reservationDate": {
            "$day": -6
        },
        "expirationDate": {
            "$day": 24
        },
        "reservationNotes": "Demo reservation for A0-05 Floor 0. [pm-demo-seed]",
        "depositAmount": "15000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "Bank transfer",
        "source": "agent",
        "paid": true,
        "paidDate": {
            "$day": -4
        },
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
            "$user": "echo@echo.com"
        },
        "client": {
            "$user": "marco.bianchi@example.com"
        },
        "reservationDate": {
            "$day": -28
        },
        "expirationDate": {
            "$day": 2
        },
        "reservationNotes": "Demo reservation for A1-01 Floor 1. [pm-demo-seed]",
        "depositAmount": "10000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "Bank transfer",
        "source": "portal",
        "paid": false,
        "paidDate": null,
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
            "$user": "echo@echo.com"
        },
        "client": {
            "$user": "sofia.keller@example.com"
        },
        "reservationDate": {
            "$day": -12
        },
        "expirationDate": {
            "$day": 18
        },
        "reservationNotes": "Demo reservation for A1-01 Floor 1. [pm-demo-seed]",
        "depositAmount": "20000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "Bank transfer",
        "source": "walk_in",
        "paid": true,
        "paidDate": {
            "$day": -11
        },
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
            "$user": "echo@echo.com"
        },
        "client": {
            "$user": "marco.bianchi@example.com"
        },
        "reservationDate": {
            "$day": -70
        },
        "expirationDate": {
            "$day": -30
        },
        "reservationNotes": "Demo reservation for A1-01 Floor 1. [pm-demo-seed]",
        "depositAmount": "12000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "Bank transfer",
        "source": "referral",
        "paid": true,
        "paidDate": {
            "$day": -68
        },
        "isActive": false,
        "status": "expired",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": {
            "$day": -30
        }
    },
    {
        "id": "6a538b10d4b6b1160814e379",
        "unit": "6a501b3388c85ab828433cc1",
        "reservedBy": {
            "$user": "echo@echo.com"
        },
        "client": {
            "$user": "elira.daka@example.com"
        },
        "reservationDate": {
            "$day": -50
        },
        "expirationDate": {
            "$day": -20
        },
        "reservationNotes": "Demo reservation for A1-02 Floor 1. [pm-demo-seed]",
        "depositAmount": "8000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "Bank transfer",
        "source": "social",
        "paid": false,
        "paidDate": null,
        "isActive": false,
        "status": "cancelled",
        "cancelledAt": {
            "$day": -40
        },
        "cancellationReason": "Client withdrew interest",
        "expiredAt": null
    },
    {
        "id": "6a538b10d4b6b1160814e37a",
        "unit": "6a501f4c88c85ab828436aaf",
        "reservedBy": {
            "$user": "echo@echo.com"
        },
        "client": {
            "$user": "sofia.keller@example.com"
        },
        "reservationDate": "2026-06-12",
        "expirationDate": "2026-07-17",
        "reservationNotes": "Demo reservation for A1-02 Floor 1. [pm-demo-seed]",
        "depositAmount": "25000",
        "depositCurrency": {
            "$currency": "EUR"
        },
        "paymentMethod": "Bank transfer",
        "source": "agent",
        "paid": true,
        "paidDate": "2026-06-14",
        "isActive": false,
        "status": "converted",
        "cancelledAt": null,
        "cancellationReason": null,
        "expiredAt": null
    }
];
