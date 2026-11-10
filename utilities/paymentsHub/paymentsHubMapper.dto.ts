import type {
    PaymentsHubRow,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import type {
    PaymentsHubStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.constants";
import type {RevenueByCurrency} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.response.type";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {decimalToNumber, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    isSettledRemaining,
    moneyNumber,
    moneyToScaled,
    remainingScaled,
    scaledToDecimal128,
    SETTLE_THRESHOLD_SCALED,
} from "@propertyManagement/utilities/lease/rentRemaining";
import {InstallmentStatus, PaymentPlanStatus} from "../../database/schemas/paymentPlan/paymentPlan";
import {calendarDaysUntil} from "../reservation/reservationExpirationCalendar";

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

/** A stored local day (`YYYY-MM-DD`, D115), or undefined when the row has none. */
function dayOf(value: unknown): string | undefined {
    return typeof value === "string" && value !== "" ? value : undefined;
}

function projectFromUnit(unit: {project?: object; floor?: {edifice?: {project?: object}}} | null | undefined) {
    const project = unit?.project ?? unit?.floor?.edifice?.project;
    return mapSnippet<ProjectSimple>()(project as object | undefined, ProjectSimpleSnippet);
}

function mapClient(sale: {buyer?: object; buyerCompany?: {_id?: unknown; name?: string} | unknown} | null | undefined): PaymentsHubRow["client"] {
    const buyer = mapSnippet<SimpleBlankUser>()(sale?.buyer, SimpleBlankUserSnippet);
    if (buyer) return {_id: buyer._id, name: buyer.name, surname: buyer.surname};
    const company = sale?.buyerCompany as {_id?: {toString(): string} | string; name?: string} | undefined;
    if (company) {
        return {
            _id: (company._id ?? company).toString(),
            companyName: typeof company.name === "string" ? company.name : undefined,
        };
    }
    return undefined;
}

/** Latest receipt day, used when an installment has receipts but no `paidDate`. Days compare as text. */
function lastReceiptDate(receipts: unknown): string | undefined {
    if (!Array.isArray(receipts) || receipts.length === 0) return undefined;
    let latest: string | undefined;
    for (const receipt of receipts) {
        const day = dayOf((receipt as {paidDate?: unknown})?.paidDate);
        if (day && (!latest || day > latest)) latest = day;
    }
    return latest;
}

export type DerivableRow = {
    storedStatus?: string | null;
    dueDate?: string | null;
    amountScaled: bigint;
    paidScaled: bigint;
    remainingScaled: bigint;
    planCancelled: boolean;
};

/**
 * Status as the hub shows it. Worked out from the amounts and the due date rather
 * than read from the stored status, which the daily cron only refreshes once a day
 * and which a partial payment overwrites. Grace days are deliberately ignored: a
 * payment is late here the day after it was due. `today` is the company's day (`YYYY-MM-DD`).
 */
export function derivePaymentsHubStatus(row: DerivableRow, today: string): PaymentsHubStatus {
    if (row.storedStatus === InstallmentStatus.CANCELLED) return "cancelled";
    if (row.amountScaled > 0n && isSettledRemaining(row.remainingScaled)) return "paid";
    if (row.storedStatus === InstallmentStatus.PAID) return "paid";
    if (row.planCancelled) return "cancelled";

    if (row.dueDate && row.dueDate < today) return "overdue";
    if (row.paidScaled > SETTLE_THRESHOLD_SCALED) return "partially_paid";
    return "pending";
}

function daysOverdueOf(dueDate: unknown, status: PaymentsHubStatus, today: string): number | undefined {
    const due = dayOf(dueDate);
    if (status !== "overdue" || !due) return undefined;
    const days = -calendarDaysUntil(due, today);
    return days > 0 ? days : undefined;
}

/**
 * Flatten one payment plan into its hub rows: the down payment (when the plan has
 * one) followed by every installment. `today` is the company's day (`YYYY-MM-DD`).
 */
export function planToHubRows(plan: Record<string, any>, today: string): PaymentsHubRow[] {
    const sale = plan.sale as any;
    const planId = plan._id.toString();
    const planCancelled = plan.status === PaymentPlanStatus.CANCELLED;
    const shared = {
        planId,
        planCode: plan.name as string | undefined,
        saleId: sale?._id ? sale._id.toString() : undefined,
        saleCode: sale?.name as string | undefined,
        currency: mapSnippet<CurrencySimple>()(sale?.saleCurrency as object | undefined, CurrencySimpleSnippet),
        client: mapClient(sale),
        unit: mapSnippet<UnitSimple>()(sale?.unit as object | undefined, UnitSimpleSnippet),
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
            today,
        );
        rows.push({
            _id: `${planId}:down_payment:0`,
            kind: "down_payment",
            status,
            ...shared,
            dueDate: dayOf(plan.startDate),
            paidDate: paid ? dayOf(plan.downPaymentDate) : undefined,
            amount: moneyNumber(scaledToDecimal128(downPaymentScaled)),
            paidAmount: moneyNumber(scaledToDecimal128(paidScaled)),
            remaining: moneyNumber(scaledToDecimal128(remaining)),
            daysOverdue: daysOverdueOf(plan.startDate, status, today),
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
            today,
        );
        rows.push({
            _id: `${planId}:installment:${installment?.installmentNumber ?? rows.length}`,
            kind: "installment",
            status,
            ...shared,
            installmentNumber: installment?.installmentNumber,
            dueDate: dayOf(installment?.dueDate),
            paidDate: dayOf(installment?.paidDate) ?? lastReceiptDate(installment?.paymentReceipts),
            amount: decimalToNumber(installment?.amount),
            paidAmount: decimalToNumber(installment?.paidAmount),
            remaining: moneyNumber(scaledToDecimal128(remaining)),
            lateFeeAmount: installment?.lateFeeAmount != null
                ? decimalToNumber(installment.lateFeeAmount)
                : undefined,
            daysOverdue: daysOverdueOf(installment?.dueDate, status, today),
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
