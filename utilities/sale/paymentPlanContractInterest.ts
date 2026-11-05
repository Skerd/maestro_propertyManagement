import {allocatePlanInterest} from "armonia/src/modules/propertyManagement/helpers/paymentPlanInterest";
import {roundToCurrency} from "armonia/src/modules/core/helpers/money";

/**
 * Contract interest over [planStartDate, planEndDate], split per installment segment. The rules live in armonia
 * (`allocatePlanInterest`, D35), shared with the sale form's preview in sinfonia.
 */

export type PaymentPlanInstallmentScheduleInput = {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    notes?: string;
};

export type PaymentPlanInstallmentScheduleComputed = PaymentPlanInstallmentScheduleInput & {
    principalAmount: number;
    interestAmount: number;
};

export type AllocatePaymentPlanContractInterestResult =
    | { ok: true; code: undefined, totalContractInterest: number; planDays: number; installments: PaymentPlanInstallmentScheduleComputed[] }
    | { ok: false; code: "invalid_schedule" | "installment_too_small" };

/**
 * Recomputes principal/interest per installment (in due-date order) from financed principal, annual %, plan
 * window, and payment amounts. Ignores any client-supplied principalAmount / interestAmount.
 */
export function allocatePaymentPlanContractInterest(params: {
    financedPrincipal: number;
    annualRatePercent: number;
    planStartDate: string;
    planEndDate: string;
    rows: PaymentPlanInstallmentScheduleInput[];
}): AllocatePaymentPlanContractInterestResult {
    const result = allocatePlanInterest(params);
    if (result.ok === false) return {ok: false, code: result.code};
    return {
        ok: true,
        code: undefined,
        totalContractInterest: result.totalContractInterest,
        planDays: result.planDays,
        installments: result.installments.map(({index: _index, ...row}) => row),
    };
}

/** UTC yyyy-MM-dd from a JS Date (calendar components in UTC). */
export function toIsoDateUtc(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function parseIsoDatePrefix(v: unknown): string {
    return String(v ?? "").trim().split("T")[0];
}

export function parseMoneyInput(v: unknown): number {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
    return Number.isFinite(n) ? roundToCurrency(n) : 0;
}
