/**
 * Leases. Active ones move their unit to rented_unit.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {LeaseSeedRow} from "./types";

export const leasesSeed: readonly LeaseSeedRow[] = [
    {
        "id": "6a538b10d4b6b1160814e37d",
        "unit": "6a501e2588c85ab828436111",
        "tenant": {
            "$user": "skerd@xhafa.com"
        },
        "startDate": "2026-04-13T12:39:44.041Z",
        "endDate": "2027-04-13T12:39:44.041Z",
        "monthlyRent": "1200",
        "rentCurrency": {
            "$currency": "EUR"
        },
        "depositAmount": "2400",
        "depositPaid": true,
        "depositReturnedAt": null,
        "status": "active",
        "notes": "Demo lease for A1-03 Floor 1. [pm-demo-seed]"
    },
    {
        "id": "6a538b10d4b6b1160814e37e",
        "unit": "6a501f4c88c85ab828436acf",
        "tenant": {
            "$user": "eniada.halebi@pronix.com"
        },
        "startDate": "2026-05-28T12:39:44.041Z",
        "endDate": "2027-05-28T12:39:44.041Z",
        "monthlyRent": "950",
        "rentCurrency": {
            "$currency": "EUR"
        },
        "depositAmount": "1900",
        "depositPaid": true,
        "depositReturnedAt": null,
        "status": "active",
        "notes": "Demo lease for A1-03 Floor 1. [pm-demo-seed]"
    },
    {
        "id": "6a538b10d4b6b1160814e37f",
        "unit": "6a501f4c88c85ab828436aed",
        "tenant": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "startDate": "2025-06-07T12:39:44.041Z",
        "endDate": "2026-06-12T12:39:44.041Z",
        "monthlyRent": "800",
        "rentCurrency": {
            "$currency": "EUR"
        },
        "depositAmount": "1600",
        "depositPaid": true,
        "depositReturnedAt": "2026-06-22T12:39:44.041Z",
        "status": "expired",
        "notes": "Demo lease for A1-04 Floor 1. [pm-demo-seed]"
    },
    {
        "id": "6a538b10d4b6b1160814e380",
        "unit": "6a501b3388c85ab828433d01",
        "tenant": {
            "$user": "almir@leka.com"
        },
        "startDate": "2025-12-24T12:39:44.041Z",
        "endDate": "2026-06-02T12:39:44.041Z",
        "monthlyRent": "1100",
        "rentCurrency": {
            "$currency": "EUR"
        },
        "depositAmount": "2200",
        "depositPaid": true,
        "depositReturnedAt": null,
        "status": "terminated",
        "notes": "Demo lease for A1-04 Floor 1. [pm-demo-seed]",
        "terminationDate": "2026-06-02T12:39:44.041Z",
        "terminationReason": "Early termination by mutual agreement"
    }
];
