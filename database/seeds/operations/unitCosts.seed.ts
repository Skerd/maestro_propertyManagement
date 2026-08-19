/**
 * Recorded costs against a unit / floor / edifice / project.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {UnitCostSeedRow} from "./types";

export const unitCostsSeed: readonly UnitCostSeedRow[] = [
    {
        "id": "6a5389bc75dbaad1890bb3da",
        "unit": "6a5018e488c85ab828431ab5",
        "floor": "6a5016c29874ae8d17646712",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "echo@echo.com"
        },
        "purchaseDate": "2026-06-02T12:34:03.627Z",
        "paymentDate": "2026-06-22T12:34:03.627Z",
        "notes": "Finish package for A0-01 Floor 0. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "paid",
        "tag": "finishes",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-1000",
        "vendorName": "Premium Finishes Albania",
        "expenditureItems": [
            {
                "title": "Porcelain flooring",
                "category": "finishes_flooring",
                "amount": 45,
                "unit": "m2",
                "pricePerUnit": "28.50"
            },
            {
                "title": "Interior paint",
                "category": "finishes_paint_wallcovering",
                "amount": 80,
                "unit": "m2",
                "pricePerUnit": "6.20"
            }
        ],
        "budgetedAmount": "2500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3dd",
        "unit": "6a501b3388c85ab828433c31",
        "floor": "6a501b3388c85ab828433c0b",
        "edifice": "6a501a7388c85ab8284338af",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "skerd@xhafa.com"
        },
        "purchaseDate": "2026-06-05T12:34:03.627Z",
        "paymentDate": null,
        "notes": "Finish package for A0-01 Floor 0. [pm-demo-seed]",
        "verificationStatus": "pending_verification",
        "paymentStatus": "unpaid",
        "tag": "finishes",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-1001",
        "vendorName": "Premium Finishes Albania",
        "expenditureItems": [
            {
                "title": "Porcelain flooring",
                "category": "finishes_flooring",
                "amount": 50,
                "unit": "m2",
                "pricePerUnit": "28.50"
            },
            {
                "title": "Interior paint",
                "category": "finishes_paint_wallcovering",
                "amount": 90,
                "unit": "m2",
                "pricePerUnit": "6.20"
            }
        ],
        "budgetedAmount": "2900",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3e0",
        "unit": "6a501b3388c85ab828433c4e",
        "floor": "6a501b3388c85ab828433c0b",
        "edifice": "6a501a7388c85ab8284338af",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "eniada.halebi@pronix.com"
        },
        "purchaseDate": "2026-06-08T12:34:03.627Z",
        "paymentDate": "2026-06-24T12:34:03.627Z",
        "notes": "Finish package for A0-02 Floor 0. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "paid",
        "tag": "finishes",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-1002",
        "vendorName": "Premium Finishes Albania",
        "expenditureItems": [
            {
                "title": "Porcelain flooring",
                "category": "finishes_flooring",
                "amount": 55,
                "unit": "m2",
                "pricePerUnit": "28.50"
            },
            {
                "title": "Interior paint",
                "category": "finishes_paint_wallcovering",
                "amount": 100,
                "unit": "m2",
                "pricePerUnit": "6.20"
            }
        ],
        "budgetedAmount": "3300",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3e3",
        "unit": "6a5018e488c85ab828431ad6",
        "floor": "6a5016c29874ae8d17646712",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "purchaseDate": "2026-06-11T12:34:03.627Z",
        "paymentDate": null,
        "notes": "Finish package for A0-02 Floor 0. [pm-demo-seed]",
        "verificationStatus": "pending_verification",
        "paymentStatus": "unpaid",
        "tag": "finishes",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-1003",
        "vendorName": "Premium Finishes Albania",
        "expenditureItems": [
            {
                "title": "Porcelain flooring",
                "category": "finishes_flooring",
                "amount": 60,
                "unit": "m2",
                "pricePerUnit": "28.50"
            },
            {
                "title": "Interior paint",
                "category": "finishes_paint_wallcovering",
                "amount": 110,
                "unit": "m2",
                "pricePerUnit": "6.20"
            }
        ],
        "budgetedAmount": "3700",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3e6",
        "unit": "6a501b3388c85ab828433c6c",
        "floor": "6a501b3388c85ab828433c0b",
        "edifice": "6a501a7388c85ab8284338af",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "almir@leka.com"
        },
        "purchaseDate": "2026-06-14T12:34:03.627Z",
        "paymentDate": "2026-06-26T12:34:03.627Z",
        "notes": "Finish package for A0-03 Floor 0. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "paid",
        "tag": "finishes",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-1004",
        "vendorName": "Premium Finishes Albania",
        "expenditureItems": [
            {
                "title": "Porcelain flooring",
                "category": "finishes_flooring",
                "amount": 65,
                "unit": "m2",
                "pricePerUnit": "28.50"
            },
            {
                "title": "Interior paint",
                "category": "finishes_paint_wallcovering",
                "amount": 120,
                "unit": "m2",
                "pricePerUnit": "6.20"
            }
        ],
        "budgetedAmount": "4100",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3e9",
        "unit": "6a5018e588c85ab828431af5",
        "floor": "6a5016c29874ae8d17646712",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "purchaseDate": "2026-06-17T12:34:03.627Z",
        "paymentDate": null,
        "notes": "Finish package for A0-03 Floor 0. [pm-demo-seed]",
        "verificationStatus": "pending_verification",
        "paymentStatus": "unpaid",
        "tag": "finishes",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-1005",
        "vendorName": "Premium Finishes Albania",
        "expenditureItems": [
            {
                "title": "Porcelain flooring",
                "category": "finishes_flooring",
                "amount": 70,
                "unit": "m2",
                "pricePerUnit": "28.50"
            },
            {
                "title": "Interior paint",
                "category": "finishes_paint_wallcovering",
                "amount": 130,
                "unit": "m2",
                "pricePerUnit": "6.20"
            }
        ],
        "budgetedAmount": "4500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3ed",
        "floor": "6a5016c29874ae8d17646712",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "eniada.halebi@pronix.com"
        },
        "purchaseDate": "2026-05-18T12:34:03.627Z",
        "notes": "Shared corridor fit-out — Floor 0. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "partially_paid",
        "tag": "common-areas",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-FL-2000",
        "vendorName": "Corridor Works Ltd",
        "expenditureItems": [
            {
                "title": "Corridor lighting fixtures",
                "category": "electrical_lighting",
                "amount": 12,
                "unit": "piece",
                "pricePerUnit": "95.00"
            }
        ],
        "budgetedAmount": "1500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3ef",
        "floor": "6a5016c29874ae8d17646721",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "purchaseDate": "2026-05-18T12:34:03.627Z",
        "notes": "Shared corridor fit-out — Floor -1. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "partially_paid",
        "tag": "common-areas",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-FL-2001",
        "vendorName": "Corridor Works Ltd",
        "expenditureItems": [
            {
                "title": "Corridor lighting fixtures",
                "category": "electrical_lighting",
                "amount": 12,
                "unit": "piece",
                "pricePerUnit": "95.00"
            }
        ],
        "budgetedAmount": "1500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3f1",
        "floor": "6a5016c29874ae8d1764673f",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "almir@leka.com"
        },
        "purchaseDate": "2026-05-18T12:34:03.627Z",
        "notes": "Shared corridor fit-out — Floor 1. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "partially_paid",
        "tag": "common-areas",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-FL-2002",
        "vendorName": "Corridor Works Ltd",
        "expenditureItems": [
            {
                "title": "Corridor lighting fixtures",
                "category": "electrical_lighting",
                "amount": 12,
                "unit": "piece",
                "pricePerUnit": "95.00"
            }
        ],
        "budgetedAmount": "1500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3f3",
        "edifice": "6a5015619874ae8d17645c66",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "echo@echo.com"
        },
        "purchaseDate": "2026-05-03T12:34:03.627Z",
        "paymentDate": "2026-05-23T12:34:03.627Z",
        "notes": "Crane hire & site logistics — Aria A. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "paid",
        "tag": "site-logistics",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-ED-3000",
        "vendorName": "Heavy Lift Adriatic",
        "expenditureItems": [
            {
                "title": "Tower crane hire (30 days)",
                "category": "professional_services",
                "amount": 30,
                "unit": "day",
                "pricePerUnit": "283.33"
            }
        ],
        "budgetedAmount": "8500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3f5",
        "edifice": "6a501a7388c85ab8284338af",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "echo@echo.com"
        },
        "purchaseDate": "2026-05-03T12:34:03.627Z",
        "paymentDate": "2026-05-23T12:34:03.627Z",
        "notes": "Crane hire & site logistics — Aria B. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "paid",
        "tag": "site-logistics",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-ED-3001",
        "vendorName": "Heavy Lift Adriatic",
        "expenditureItems": [
            {
                "title": "Tower crane hire (30 days)",
                "category": "professional_services",
                "amount": 30,
                "unit": "day",
                "pricePerUnit": "283.33"
            }
        ],
        "budgetedAmount": "8500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    },
    {
        "id": "6a5389bc75dbaad1890bb3f7",
        "project": "6a4f94ae99511ee1e0efb78a",
        "purchasePerson": {
            "$user": "skerd@xhafa.com"
        },
        "purchaseDate": "2026-04-13T12:34:03.627Z",
        "paymentDate": "2026-04-23T12:34:03.627Z",
        "notes": "Building permits and municipal fees. [pm-demo-seed]",
        "verificationStatus": "verified",
        "paymentStatus": "paid",
        "tag": "permits",
        "currency": {
            "$currency": "EUR"
        },
        "invoiceNumber": "INV-DEMO-PRJ-4000",
        "vendorName": "Municipality of Himarë",
        "expenditureItems": [
            {
                "title": "Building permit fees",
                "category": "permits_fees_taxes",
                "amount": 1,
                "unit": "piece",
                "pricePerUnit": "12500.00"
            }
        ],
        "budgetedAmount": "12500",
        "budgetCurrency": {
            "$currency": "EUR"
        }
    }
];
