/**
 * Sales. Every sale moves its unit to sold_unit.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {SaleSeedRow} from "./types";

export const salesSeed: readonly SaleSeedRow[] = [
    {
        "id": "6a538b10d4b6b1160814e37c",
        "unit": "6a501e2588c85ab8284360f5",
        "paymentType": "cash",
        "buyer": {
            "$user": "eniada.halebi@pronix.com"
        },
        "soldBy": {
            "$user": "echo@echo.com"
        },
        "saleDate": "2026-06-27T12:39:44.041Z",
        "listedUnitPrice": "290592",
        "listedUnitCurrency": {
            "$currency": "EUR"
        },
        "saleExchangeRate": "1",
        "localDiscount": "0",
        "finalPrice": "290592",
        "saleCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo sale for A1-02 Floor 1. [pm-demo-seed]",
        "transactionReference": "TX-DEMO-2001",
        "handoverDate": null
    },
    {
        "id": "6a538b10d4b6b1160814e37b",
        "unit": "6a5018e588c85ab828431b85",
        "paymentType": "cash",
        "buyer": {
            "$user": "skerd@xhafa.com"
        },
        "soldBy": {
            "$user": "echo@echo.com"
        },
        "saleDate": "2026-06-02T12:39:44.041Z",
        "listedUnitPrice": "340880",
        "listedUnitCurrency": {
            "$currency": "EUR"
        },
        "saleExchangeRate": "1",
        "localDiscount": "2",
        "finalPrice": "334062.4",
        "saleCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo sale for A1-02 Floor 1. [pm-demo-seed]",
        "transactionReference": "TX-DEMO-2000",
        "handoverDate": "2026-06-12T12:39:44.041Z",
        "handedOverBy": {
            "$user": "echo@echo.com"
        },
        "handoverNotes": "Keys and manuals handed over to buyer.",
        "titleTransferDate": "2026-06-07T12:39:44.041Z",
        "deedNumber": "DEED-DEMO-3000",
        "notaryName": "Notary Office Dhërmi"
    },
    {
        "id": "6a538b26531fa6196cdb275b",
        "unit": "6a501f4c88c85ab828436aaf",
        "paymentType": "cash",
        "buyer": {
            "$user": "skerd@xhafa.com"
        },
        "soldBy": {
            "$user": "echo@echo.com"
        },
        "saleDate": "2026-06-30T12:40:06.097Z",
        "listedUnitPrice": "333696",
        "listedUnitCurrency": {
            "$currency": "EUR"
        },
        "saleExchangeRate": "1",
        "localDiscount": "1",
        "finalPrice": "330359.04",
        "saleCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo sale for A1-02 Floor 1. [pm-demo-seed]",
        "transactionReference": "TX-DEMO-2100",
        "reservation": "6a538b10d4b6b1160814e37a",
        "reservationDepositAmount": "25000",
        "reservationDepositCurrency": {
            "$currency": "EUR"
        },
        "reservationExchangeRate": "1",
        "reservationConvertedAmount": "25000"
    },
    {
        "id": "6a538b37fde40595860c93dc",
        "unit": "6a501b3388c85ab828433c4e",
        "paymentType": "payment_plan",
        "buyer": {
            "$user": "eniada.halebi@pronix.com"
        },
        "soldBy": {
            "$user": "echo@echo.com"
        },
        "saleDate": "2026-05-28T12:40:23.197Z",
        "listedUnitPrice": "419808",
        "listedUnitCurrency": {
            "$currency": "EUR"
        },
        "saleExchangeRate": "1",
        "localDiscount": "4",
        "finalPrice": "403015.68",
        "saleCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo sale for A0-02 Floor 0. [pm-demo-seed]",
        "transactionReference": "TX-DEMO-559195C2",
        "paymentPlan": "6a538b37fde40595860c93dd"
    },
    {
        "id": "6a538b37fde40595860c93da",
        "unit": "6a501b3388c85ab828433c31",
        "paymentType": "payment_plan",
        "buyer": {
            "$user": "skerd@xhafa.com"
        },
        "soldBy": {
            "$user": "echo@echo.com"
        },
        "saleDate": "2026-06-17T12:40:23.197Z",
        "listedUnitPrice": "499312",
        "listedUnitCurrency": {
            "$currency": "EUR"
        },
        "saleExchangeRate": "1",
        "localDiscount": "3",
        "finalPrice": "484332.64",
        "saleCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo sale for A0-01 Floor 0. [pm-demo-seed]",
        "transactionReference": "TX-DEMO-A88E46F9",
        "paymentPlan": "6a538b37fde40595860c93db"
    }
];
