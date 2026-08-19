/**
 * Agent commissions raised off a reservation or sale.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {CommissionSeedRow} from "./types";

export const commissionsSeed: readonly CommissionSeedRow[] = [
    {
        "id": "6a538c6fb51ba82f116ee5fc",
        "agent": {
            "$user": "echo@echo.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "reservation",
        "sourceId": "6a538b10d4b6b1160814e375",
        "reservation": "6a538b10d4b6b1160814e375",
        "basis": "depositAmount",
        "basisAmount": "15000.00",
        "ratePercent": 2,
        "amount": "300.00",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo commission for RES-20260707-41CE6A67. [pm-demo-seed]",
        "paidAt": "2026-07-10T12:45:35.101Z",
        "voidedAt": null,
        "paymentReference": "PAY-COMM-RES-41CE6A67"
    },
    {
        "id": "6a538c6fb51ba82f116ee5fd",
        "agent": {
            "$user": "eniada.halebi@pronix.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "reservation",
        "sourceId": "6a538b10d4b6b1160814e377",
        "reservation": "6a538b10d4b6b1160814e377",
        "basis": "depositAmount",
        "basisAmount": "20000.00",
        "ratePercent": 2,
        "amount": "400.00",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending",
        "notes": "Demo commission for RES-20260702-6B6C7FDF. [pm-demo-seed]",
        "paidAt": null,
        "voidedAt": null,
        "paymentReference": null
    },
    {
        "id": "6a538c6fb51ba82f116ee5fe",
        "agent": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "reservation",
        "sourceId": "6a538b10d4b6b1160814e378",
        "reservation": "6a538b10d4b6b1160814e378",
        "basis": "depositAmount",
        "basisAmount": "12000.00",
        "ratePercent": 2,
        "amount": "240.00",
        "currency": {
            "$currency": "EUR"
        },
        "status": "voided",
        "notes": "Demo commission for RES-20260528-3337733A. [pm-demo-seed]",
        "paidAt": null,
        "voidedAt": "2026-07-07T12:39:44.041Z",
        "paymentReference": null
    },
    {
        "id": "6a538c6fb51ba82f116ee5ff",
        "agent": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "reservation",
        "sourceId": "6a538b10d4b6b1160814e37a",
        "reservation": "6a538b10d4b6b1160814e37a",
        "basis": "depositAmount",
        "basisAmount": "25000.00",
        "ratePercent": 2,
        "amount": "500.00",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending",
        "notes": "Demo commission for RES-20260612-7942CD8B. [pm-demo-seed]",
        "paidAt": null,
        "voidedAt": null,
        "paymentReference": null
    },
    {
        "id": "6a538c6fb51ba82f116ee600",
        "agent": {
            "$user": "echo@echo.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "sale",
        "sourceId": "6a538b10d4b6b1160814e37b",
        "sale": "6a538b10d4b6b1160814e37b",
        "basis": "finalPrice",
        "basisAmount": "334062.40",
        "ratePercent": 4,
        "amount": "13362.50",
        "currency": {
            "$currency": "EUR"
        },
        "status": "paid",
        "notes": "Demo commission for SALE-20260602-08AEC9FC. [pm-demo-seed]",
        "paidAt": "2026-07-07T12:45:35.101Z",
        "paymentReference": "PAY-COMM-SALE-08AEC9FC"
    },
    {
        "id": "6a538c6fb51ba82f116ee601",
        "agent": {
            "$user": "echo@echo.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "sale",
        "sourceId": "6a538b10d4b6b1160814e37c",
        "sale": "6a538b10d4b6b1160814e37c",
        "basis": "finalPrice",
        "basisAmount": "290592.00",
        "ratePercent": 4,
        "amount": "11623.68",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending",
        "notes": "Demo commission for SALE-20260627-2FA45ABC. [pm-demo-seed]",
        "paidAt": null,
        "paymentReference": null
    },
    {
        "id": "6a538c6fb51ba82f116ee602",
        "agent": {
            "$user": "echo@echo.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "sale",
        "sourceId": "6a538b26531fa6196cdb275b",
        "sale": "6a538b26531fa6196cdb275b",
        "basis": "finalPrice",
        "basisAmount": "330359.04",
        "ratePercent": 4,
        "amount": "13214.36",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending",
        "notes": "Demo commission for SALE-20260630-8352B7D1. [pm-demo-seed]",
        "paidAt": null,
        "paymentReference": null
    },
    {
        "id": "6a538c6fb51ba82f116ee603",
        "agent": {
            "$user": "echo@echo.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "sale",
        "sourceId": "6a538b37fde40595860c93da",
        "sale": "6a538b37fde40595860c93da",
        "basis": "finalPrice",
        "basisAmount": "484332.64",
        "ratePercent": 4,
        "amount": "19373.31",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending_approval",
        "notes": "Demo commission for SALE-20260617-7F6587E2. [pm-demo-seed]",
        "paidAt": null,
        "paymentReference": null
    },
    {
        "id": "6a538c6fb51ba82f116ee604",
        "agent": {
            "$user": "echo@echo.com"
        },
        "recordedByActionUser": {
            "$user": "echo@echo.com"
        },
        "sourceType": "sale",
        "sourceId": "6a538b37fde40595860c93dc",
        "sale": "6a538b37fde40595860c93dc",
        "basis": "finalPrice",
        "basisAmount": "403015.68",
        "ratePercent": 4,
        "amount": "16120.63",
        "currency": {
            "$currency": "EUR"
        },
        "status": "pending",
        "notes": "Demo commission for SALE-20260528-E3435C38. [pm-demo-seed]",
        "paidAt": null,
        "paymentReference": null
    }
];
