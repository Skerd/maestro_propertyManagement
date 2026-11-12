/**
 * Leases. Each one rents its unit out; its rent rows are generated from the lease, not listed here.
 *
 * Curated by hand (TD-B206): the tenants are the demo clients in `demoClients.ts`.
 */
import type {LeaseSeedRow} from "./types";

export const leasesSeed: readonly LeaseSeedRow[] = [
    {
        "id": "6a538b10d4b6b1160814e37d",
        "unit": "6a501e2588c85ab828436111",
        "tenant": {
            "$user": "sofia.keller@example.com"
        },
        "startDate": "2026-04-13",
        "endDate": "2027-04-12",
        "monthlyRent": "1200",
        "rentCurrency": {
            "$currency": "EUR"
        },
        "depositAmount": "2400",
        "depositPaid": true,
        "notes": "Demo lease for A1-03 Floor 1. [pm-demo-seed]",
        "unpaidDueMonths": 1
    },
    {
        "id": "6a538b10d4b6b1160814e37e",
        "unit": "6a501f4c88c85ab828436acf",
        "tenant": {
            "$user": "marco.bianchi@example.com"
        },
        "startDate": "2026-05-28",
        "endDate": "2027-05-27",
        "monthlyRent": "950",
        "rentCurrency": {
            "$currency": "EUR"
        },
        "depositAmount": "1900",
        "depositPaid": true,
        "notes": "Demo lease for A1-03 Floor 1. [pm-demo-seed]",
        "unpaidDueMonths": 0
    }
];
