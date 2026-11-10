import {allocatePlanInterest, type PlanScheduleErrorCode} from "armonia/src/modules/propertyManagement/helpers/paymentPlanInterest";
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
    | { ok: false; code: PlanScheduleErrorCode };

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
    /** The sale currency's decimal places. */
    decimals?: number;
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

/** The exception key a refused schedule answers with. */
export function paymentPlanScheduleErrorKey(code: PlanScheduleErrorCode): string {
    if (code === "installment_too_small") return "payment_plan_installment_too_small";
    if (code === "installment_exceeds_owed") return "payment_plan_installment_exceeds_owed";
    if (code === "principal_residual") return "payment_plan_principal_not_covered";
    return "payment_plan_schedule_invalid";
}

export function parseIsoDatePrefix(v: unknown): string {
    return String(v ?? "").trim().split("T")[0];
}

/** A posted amount rounded once to the sale currency's `decimals` (D35); not a number reads as 0. */
export function parseMoneyInput(v: unknown, decimals?: number): number {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
    return Number.isFinite(n) ? roundToCurrency(n, decimals) : 0;
}
