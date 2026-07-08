import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {type ISale, SalePaymentType} from "../../../database/schemas/sale/sale";

const PAYMENT_TYPE_LABEL: Record<SalePaymentType, string> = {
    [SalePaymentType.CASH]: "Cash",
    [SalePaymentType.PAYMENT_PLAN]: "Payment plan",
};

export function saleToSelect(sale: ISale): ApiSelectDatum {
    let label = "";

    if (sale.name) {
        label = sale.name;
    }

    if (sale.unit && typeof sale.unit === "object" && "_id" in sale.unit) {
        const unit = sale.unit as {name?: string; unitNumber?: string};
        let unitLabel = "";
        if (unit.unitNumber) {
            unitLabel = unit.unitNumber;
        }
        if (unit.name && unitLabel) {
            unitLabel += ` — ${unit.name}`;
        } else if (unit.name) {
            unitLabel = unit.name;
        }
        if (unitLabel) {
            label = label ? `${label} [${unitLabel}]` : unitLabel;
        }
    }

    if (sale.saleDate) {
        const d = new Date(sale.saleDate as Date).toLocaleDateString();
        label = label ? `${label} (${d})` : d;
    }

    if (sale.paymentType && PAYMENT_TYPE_LABEL[sale.paymentType as SalePaymentType]) {
        const pt = PAYMENT_TYPE_LABEL[sale.paymentType as SalePaymentType];
        label = label ? `${label} · ${pt}` : pt;
    }

    if (!label) {
        label = sale._id.toString();
    }

    return {
        value: sale._id.toString(),
        label,
    };
}

export function salesToSelect(sales: ISale[]): ApiSelectDatum[] {
    return sales.map((s) => saleToSelect(s));
}
