import type {
    PaymentsHubRow,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import type {
    PaymentsHubStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.constants";
import type {RevenueByCurrency} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.response.type";
import {
    decimalToNumber,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser,
} from "@coreModule/utilities/mappers/common.mapper";
import {
    isSettledRemaining,
    moneyNumber,
    moneyToScaled,
    remainingScaled,
    scaledToDecimal128,
    SETTLE_THRESHOLD_SCALED,
} from "@propertyManagement/utilities/lease/rentRemaining";
import {InstallmentStatus, PaymentPlanStatus} from "../../database/schemas/paymentPlan/paymentPlan";

/**
 * Sale-side data every hub row needs: unit, project, buyer and currency. Populated
 * exactly like the rentals hub does it, so field-level allowlists behave the same.
 */
export const PAYMENTS_HUB_PLAN_POPULATE = [
    {
        path: "sale",
        populate: [
            {
                path: "unit",
                populate: [
                    {path: "project", select: "name"},
                    {
                        path: "floor",
                        populate: {
                            path: "edifice",
                            populate: {path: "project", select: "name"},
                        },
                    },
                ],
            },
            {path: "buyer", select: "name surname email username"},
            {path: "buyerCompany", select: "name"},
            {path: "saleCurrency", select: "name symbol abbreviation"},
        ],
    },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of the day `now` falls on. Due dates are stored as UTC dates. */
export function startOfUtcDay(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toIso(value: unknown): string | undefined {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function projectFromUnit(unit: any): {_id: string; name?: string} | undefined {
    const project = unit?.project ?? unit?.floor?.edifice?.project;
    if (!project) return undefined;
    return {_id: (project._id ?? project).toString(), name: project.name};
}

function mapUnit(unit: any): PaymentsHubRow["unit"] {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() ?? String(unit),
        name: unit.name,
        unitNumber: unit.unitNumber,
    };
}

function mapClient(sale: any): PaymentsHubRow["client"] {
    const buyer = mapPopulatedSimpleUser(sale?.buyer);
    if (buyer) return {_id: buyer._id, name: buyer.name, surname: buyer.surname};
    const company = sale?.buyerCompany;
    if (company) {
        return {
            _id: (company._id ?? company).toString(),
            companyName: typeof company.name === "string" ? company.name : undefined,
        };
    }
    return undefined;
}

/** Latest receipt date, used when an installment has receipts but no `paidDate`. */
function lastReceiptDate(receipts: unknown): Date | undefined {
    if (!Array.isArray(receipts) || receipts.length === 0) return undefined;
    let latest: Date | undefined;
    for (const receipt of receipts) {
        const raw = (receipt as {paidDate?: unknown})?.paidDate;
        if (!raw) continue;
        const d = raw instanceof Date ? raw : new Date(raw as string);
        if (Number.isNaN(d.getTime())) continue;
        if (!latest || d > latest) latest = d;
    }
    return latest;
}

export type DerivableRow = {
    storedStatus?: string | null;
    dueDate?: Date | string | null;
    amountScaled: bigint;
    paidScaled: bigint;
    remainingScaled: bigint;
    planCancelled: boolean;
};

/**
 * Status as the hub shows it. Worked out from the amounts and the due date rather
 * than read from the stored status, which the daily cron only refreshes once a day
 * and which a partial payment overwrites. Grace days are deliberately ignored: a
 * payment is late here the day after it was due.
 */
export function derivePaymentsHubStatus(row: DerivableRow, now: Date): PaymentsHubStatus {
    if (row.storedStatus === InstallmentStatus.CANCELLED) return "cancelled";
    if (row.amountScaled > 0n && isSettledRemaining(row.remainingScaled)) return "paid";
    if (row.storedStatus === InstallmentStatus.PAID) return "paid";
    if (row.planCancelled) return "cancelled";

    const due = row.dueDate instanceof Date ? row.dueDate : row.dueDate ? new Date(row.dueDate) : undefined;
    const isOverdue = !!due && !Number.isNaN(due.getTime()) && due < startOfUtcDay(now);
    if (isOverdue) return "overdue";
    if (row.paidScaled > SETTLE_THRESHOLD_SCALED) return "partially_paid";
    return "pending";
}

function daysOverdueOf(dueDate: unknown, status: PaymentsHubStatus, now: Date): number | undefined {
    if (status !== "overdue" || !dueDate) return undefined;
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate as string);
    if (Number.isNaN(due.getTime())) return undefined;
    const diff = startOfUtcDay(now).getTime() - startOfUtcDay(due).getTime();
    return diff > 0 ? Math.floor(diff / DAY_MS) : undefined;
}

/**
 * Flatten one payment plan into its hub rows: the down payment (when the plan has
 * one) followed by every installment.
 */
export function planToHubRows(plan: Record<string, any>, now: Date): PaymentsHubRow[] {
    const sale = plan.sale as any;
    const planId = plan._id.toString();
    const planCancelled = plan.status === PaymentPlanStatus.CANCELLED;
    const shared = {
        planId,
        planCode: plan.name as string | undefined,
        saleId: sale?._id ? sale._id.toString() : undefined,
        saleCode: sale?.name as string | undefined,
        currency: mapPopulatedSimpleCurrency(sale?.saleCurrency),
        client: mapClient(sale),
        unit: mapUnit(sale?.unit),
        project: projectFromUnit(sale?.unit),
    };

    const rows: PaymentsHubRow[] = [];

    const downPaymentScaled = moneyToScaled(plan.downPayment);
    if (downPaymentScaled > 0n) {
        const paid = plan.downPaymentPaid === true;
        const paidScaled = paid ? downPaymentScaled : 0n;
        const remaining = paid ? 0n : downPaymentScaled;
        const status = derivePaymentsHubStatus(
            {
                storedStatus: paid ? InstallmentStatus.PAID : InstallmentStatus.PENDING,
                // A down payment is due when the plan starts; `downPaymentDate` is when it was made.
                dueDate: plan.startDate,
                amountScaled: downPaymentScaled,
                paidScaled,
                remainingScaled: remaining,
                planCancelled,
            },
            now,
        );
        rows.push({
            _id: `${planId}:down_payment:0`,
            kind: "down_payment",
            status,
            ...shared,
            dueDate: toIso(plan.startDate),
            paidDate: paid ? toIso(plan.downPaymentDate) : undefined,
            amount: moneyNumber(scaledToDecimal128(downPaymentScaled)),
            paidAmount: moneyNumber(scaledToDecimal128(paidScaled)),
            remaining: moneyNumber(scaledToDecimal128(remaining)),
            daysOverdue: daysOverdueOf(plan.startDate, status, now),
        });
    }

    for (const installment of (plan.installments ?? []) as any[]) {
        const storedStatus = installment?.status as string | undefined;
        const amountScaled = moneyToScaled(installment?.amount);
        const paidScaled = moneyToScaled(installment?.paidAmount);
        // `remainingScaled` only zeroes waived rentals, so cancelled installments are handled here.
        const remaining = storedStatus === InstallmentStatus.CANCELLED
            ? 0n
            : remainingScaled({
                amount: installment?.amount,
                paidAmount: installment?.paidAmount,
                lateFeeAmount: installment?.lateFeeAmount,
                status: storedStatus,
            });
        const status = derivePaymentsHubStatus(
            {
                storedStatus,
                dueDate: installment?.dueDate,
                amountScaled,
                paidScaled,
                remainingScaled: remaining,
                planCancelled,
            },
            now,
        );
        rows.push({
            _id: `${planId}:installment:${installment?.installmentNumber ?? rows.length}`,
            kind: "installment",
            status,
            ...shared,
            installmentNumber: installment?.installmentNumber,
            dueDate: toIso(installment?.dueDate),
            paidDate: toIso(installment?.paidDate ?? lastReceiptDate(installment?.paymentReceipts)),
            amount: decimalToNumber(installment?.amount),
            paidAmount: decimalToNumber(installment?.paidAmount),
            remaining: moneyNumber(scaledToDecimal128(remaining)),
            lateFeeAmount: installment?.lateFeeAmount != null
                ? decimalToNumber(installment.lateFeeAmount)
                : undefined,
            daysOverdue: daysOverdueOf(installment?.dueDate, status, now),
        });
    }

    return rows;
}

export type CurrencyBucket = {
    currencyId: string;
    currencyName?: string;
    currencySymbol?: string;
    scaled: bigint;
};

/** Money never crosses currencies: every total is kept per sale currency. */
export function addToBuckets(
    map: Map<string, CurrencyBucket>,
    row: PaymentsHubRow,
    amount: number | undefined,
): void {
    const scaled = moneyToScaled(amount);
    if (scaled === 0n) return;
    const currencyId = row.currency?._id ?? "_none";
    const prev = map.get(currencyId) ?? {
        currencyId,
        currencyName: row.currency?.name,
        currencySymbol: row.currency?.symbol,
        scaled: 0n,
    };
    prev.scaled += scaled;
    map.set(currencyId, prev);
}

export function bucketsToRevenue(map: Map<string, CurrencyBucket>): RevenueByCurrency[] {
    return [...map.values()]
        .filter((bucket) => bucket.scaled !== 0n)
        .map((bucket) => ({
            currencyId: bucket.currencyId,
            currencyName: bucket.currencyName,
            currencySymbol: bucket.currencySymbol,
            value: moneyNumber(scaledToDecimal128(bucket.scaled)),
        }));
}
