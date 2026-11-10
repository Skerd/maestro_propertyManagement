/**
 * Rent instalments belonging to a lease.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {RentalPaymentSeedRow} from "./types";

export const rentalPaymentsSeed: readonly RentalPaymentSeedRow[] = [
    {
        "id": "6a538b10d4b6b1160814e381",
        "lease": "6a538b10d4b6b1160814e37d",
        "unit": "6a501e2588c85ab828436111",
        "dueDate": "2026-05-13",
        "amount": "1200",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 1. [pm-demo-seed]",
        "paidDate": "2026-05-12",
        "paidAmount": "1200"
    },
    {
        "id": "6a538b10d4b6b1160814e382",
        "lease": "6a538b10d4b6b1160814e37d",
        "unit": "6a501e2588c85ab828436111",
        "dueDate": "2026-06-12",
        "amount": "1200",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 2. [pm-demo-seed]",
        "paidDate": "2026-06-11",
        "paidAmount": "1200"
    },
    {
        "id": "6a538b10d4b6b1160814e383",
        "lease": "6a538b10d4b6b1160814e37d",
        "unit": "6a501e2588c85ab828436111",
        "dueDate": "2026-07-12",
        "amount": "1200",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 3. [pm-demo-seed]",
        "paidDate": "2026-07-11",
        "paidAmount": "1200"
    },
    {
        "id": "6a538b10d4b6b1160814e384",
        "lease": "6a538b10d4b6b1160814e37d",
        "unit": "6a501e2588c85ab828436111",
        "dueDate": "2026-07-02",
        "amount": "1200",
        "currency": {
            "$currency": "EUR"
        },
        "status": "overdue",
        "notes": "Demo rental payment month 4. [pm-demo-seed] overdue"
    },
    {
        "id": "6a538b10d4b6b1160814e385",
        "lease": "6a538b10d4b6b1160814e37e",
        "unit": "6a501f4c88c85ab828436acf",
        "dueDate": "2026-06-27",
        "amount": "950",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 1. [pm-demo-seed]",
        "paidDate": "2026-06-26",
        "paidAmount": "950"
    },
    {
        "id": "6a538b10d4b6b1160814e386",
        "lease": "6a538b10d4b6b1160814e37e",
        "unit": "6a501f4c88c85ab828436acf",
        "dueDate": "2026-07-27",
        "amount": "950",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 2. [pm-demo-seed]",
        "paidDate": "2026-07-26",
        "paidAmount": "950"
    },
    {
        "id": "6a538b10d4b6b1160814e387",
        "lease": "6a538b10d4b6b1160814e37e",
        "unit": "6a501f4c88c85ab828436acf",
        "dueDate": "2026-08-26",
        "amount": "950",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 3. [pm-demo-seed]",
        "paidDate": "2026-08-25",
        "paidAmount": "950"
    },
    {
        "id": "6a538b10d4b6b1160814e388",
        "lease": "6a538b10d4b6b1160814e37e",
        "unit": "6a501f4c88c85ab828436acf",
        "dueDate": "2026-09-25",
        "amount": "950",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending",
        "notes": "Demo rental payment month 4. [pm-demo-seed]"
    },
    {
        "id": "6a538b10d4b6b1160814e389",
        "lease": "6a538b10d4b6b1160814e37f",
        "unit": "6a501f4c88c85ab828436aed",
        "dueDate": "2025-07-07",
        "amount": "800",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 1. [pm-demo-seed]",
        "paidDate": "2025-07-06",
        "paidAmount": "800"
    },
    {
        "id": "6a538b10d4b6b1160814e38a",
        "lease": "6a538b10d4b6b1160814e37f",
        "unit": "6a501f4c88c85ab828436aed",
        "dueDate": "2025-08-06",
        "amount": "800",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 2. [pm-demo-seed]",
        "paidDate": "2025-08-05",
        "paidAmount": "800"
    },
    {
        "id": "6a538b10d4b6b1160814e38b",
        "lease": "6a538b10d4b6b1160814e37f",
        "unit": "6a501f4c88c85ab828436aed",
        "dueDate": "2025-09-05",
        "amount": "800",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 3. [pm-demo-seed]",
        "paidDate": "2025-09-04",
        "paidAmount": "800"
    },
    {
        "id": "6a538b10d4b6b1160814e38c",
        "lease": "6a538b10d4b6b1160814e37f",
        "unit": "6a501f4c88c85ab828436aed",
        "dueDate": "2025-10-05",
        "amount": "800",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 4. [pm-demo-seed]",
        "paidDate": "2025-10-04",
        "paidAmount": "800"
    },
    {
        "id": "6a538b10d4b6b1160814e38d",
        "lease": "6a538b10d4b6b1160814e380",
        "unit": "6a501b3388c85ab828433d01",
        "dueDate": "2026-01-23",
        "amount": "1100",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 1. [pm-demo-seed]",
        "paidDate": "2026-01-22",
        "paidAmount": "1100"
    },
    {
        "id": "6a538b10d4b6b1160814e38e",
        "lease": "6a538b10d4b6b1160814e380",
        "unit": "6a501b3388c85ab828433d01",
        "dueDate": "2026-02-22",
        "amount": "1100",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 2. [pm-demo-seed]",
        "paidDate": "2026-02-21",
        "paidAmount": "1100"
    },
    {
        "id": "6a538b10d4b6b1160814e38f",
        "lease": "6a538b10d4b6b1160814e380",
        "unit": "6a501b3388c85ab828433d01",
        "dueDate": "2026-03-24",
        "amount": "1100",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo rental payment month 3. [pm-demo-seed]",
        "paidDate": "2026-03-23",
        "paidAmount": "1100"
    },
    {
        "id": "6a538b10d4b6b1160814e390",
        "lease": "6a538b10d4b6b1160814e380",
        "unit": "6a501b3388c85ab828433d01",
        "dueDate": "2026-04-23",
        "amount": "1100",
        "currency": {
            "$currency": "EUR"
        },
        "status": "waived",
        "notes": "Demo rental payment month 4. [pm-demo-seed]"
    }
];
