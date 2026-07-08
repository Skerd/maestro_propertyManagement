/**
 * Server-side contract interest over [planStartDate, planEndDate] with pro-rata allocation
 * per installment segment (same rules as sinfonia payment plan preview).
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

function roundMoney(value: number): number {
    return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function dayUtcMs(isoDate: string): number {
    const parts = isoDate.trim().split("-").map((x) => Number.parseInt(x, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return Number.NaN;
    const [y, m, d] = parts;
    return Date.UTC(y, m - 1, d);
}

function daysBetweenUtc(fromIso: string, toIso: string): number {
    const from = dayUtcMs(fromIso);
    const to = dayUtcMs(toIso);
    if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
    return Math.round((to - from) / 86400000);
}

/**
 * Recomputes principal/interest per installment from financed principal, annual %, plan window, and payment amounts.
 * Ignores any client-supplied principalAmount / interestAmount.
 */
export function allocatePaymentPlanContractInterest(params: {
    financedPrincipal: number;
    annualRatePercent: number;
    planStartDate: string;
    planEndDate: string;
    rows: PaymentPlanInstallmentScheduleInput[];
}): AllocatePaymentPlanContractInterestResult {
    const principal = roundMoney(params.financedPrincipal);
    if (!Number.isFinite(principal) || principal < 0) return { ok: false, code: "invalid_schedule" };
    if (!params.planStartDate?.trim() || !params.planEndDate?.trim() || params.rows.length === 0) {
        return { ok: false, code: "invalid_schedule" };
    }

    const planStart = params.planStartDate.trim();
    const planEnd = params.planEndDate.trim();
    const planDays = daysBetweenUtc(planStart, planEnd);
    if (Number.isNaN(planDays) || planDays <= 0) return { ok: false, code: "invalid_schedule" };

    const sortedRows = [...params.rows].sort((a, b) => {
        const da = dayUtcMs(a.dueDate);
        const db = dayUtcMs(b.dueDate);
        if (da !== db) return da - db;
        return a.installmentNumber - b.installmentNumber;
    });

    for (const row of sortedRows) {
        if (Number.isNaN(dayUtcMs(row.dueDate))) return { ok: false, code: "invalid_schedule" };
        if (roundMoney(Number(row.amount) || 0) <= 0) return { ok: false, code: "invalid_schedule" };
    }

    const planEndMs = dayUtcMs(planEnd);
    const planStartMs = dayUtcMs(planStart);
    if (Number.isNaN(planEndMs) || Number.isNaN(planStartMs)) return { ok: false, code: "invalid_schedule" };

    let prevDueMs = Number.NEGATIVE_INFINITY;
    const segmentDays: number[] = [];
    for (let i = 0; i < sortedRows.length; i++) {
        const due = sortedRows[i].dueDate.trim();
        const dueMs = dayUtcMs(due);
        if (Number.isNaN(dueMs) || dueMs < planStartMs || dueMs > planEndMs) return { ok: false, code: "invalid_schedule" };
        if (dueMs <= prevDueMs) return { ok: false, code: "invalid_schedule" };
        prevDueMs = dueMs;
        const prevIso = i === 0 ? planStart : sortedRows[i - 1].dueDate.trim();
        const d = daysBetweenUtc(prevIso, due);
        if (Number.isNaN(d) || d < 0) return { ok: false, code: "invalid_schedule" };
        segmentDays.push(d);
    }

    const lastDue = sortedRows[sortedRows.length - 1].dueDate.trim();
    const spanDays = daysBetweenUtc(planStart, lastDue);
    if (Number.isNaN(spanDays) || spanDays !== planDays) return { ok: false, code: "invalid_schedule" };

    const rate = (Number(params.annualRatePercent) || 0) / 100;
    const totalContractInterest =
        rate <= 0 || principal <= 0 ? 0 : roundMoney(principal * rate * (planDays / 365));

    const n = sortedRows.length;
    const allocatedInterest: number[] = [];
    let interestSum = 0;
    for (let i = 0; i < n - 1; i++) {
        const part = planDays <= 0 ? 0 : roundMoney((totalContractInterest * segmentDays[i]) / planDays);
        allocatedInterest.push(part);
        interestSum += part;
    }
    allocatedInterest.push(roundMoney(totalContractInterest - interestSum));

    let remaining = principal;
    const out: PaymentPlanInstallmentScheduleComputed[] = [];

    for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        const amount = roundMoney(Number(row.amount) || 0);
        const interestAccrued = allocatedInterest[i] ?? 0;
        const rawPrincipal = roundMoney(amount - interestAccrued);
        if (rawPrincipal < -0.005) return { ok: false, code: "installment_too_small" };

        let principalAmount: number;
        if (rawPrincipal > remaining + 0.005) {
            principalAmount = roundMoney(Math.max(0, remaining));
        } else {
            principalAmount = rawPrincipal;
        }
        const interestAmount = roundMoney(amount - principalAmount);

        remaining = roundMoney(remaining - principalAmount);
        out.push({
            installmentNumber: row.installmentNumber,
            dueDate: row.dueDate.trim(),
            amount,
            notes: row.notes,
            principalAmount: Math.max(0, principalAmount),
            interestAmount: Math.max(0, interestAmount),
        });
    }

    return { ok: true, code: undefined, totalContractInterest, planDays, installments: out };
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
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}
