import type {ClientSession, ObjectId} from "mongodb";
import {paymentPlanService} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan.service";
import {formatReservationExpirationForEmail} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {formatMoneyAmountForEmail} from "./reservationEmailFormatting";

/** One installment row of the payment-plan table in sale emails (already formatted). */
export type PaymentScheduleRowForEmail = {
    installmentNumber: number;
    dueDate: string;
    amount: string;
    /** Set on every row only when the plan carries interest. */
    principal?: string;
    interest?: string;
};

export type SalePlanSummaryForEmail = {
    /** Always set (0 when there is no plan / down payment). */
    downPaymentDisplay: string;
    /** Only for a non-zero down payment. */
    downPaymentPaid?: boolean;
    numberOfInstallments?: number;
    paymentSchedule?: PaymentScheduleRowForEmail[];
};

type InstallmentLike = {
    installmentNumber: number;
    dueDate: Date | string;
    amount?: {toString(): string} | null;
    principalAmount?: {toString(): string} | null;
    interestAmount?: {toString(): string} | null;
};

function money(raw: {toString(): string} | null | undefined, symbol: string | undefined, languageCode: string): string {
    const amt = formatMoneyAmountForEmail(raw?.toString() ?? "0", languageCode);
    return symbol ? `${amt} ${symbol}` : amt;
}

export function buildPaymentScheduleForEmail(
    installments: InstallmentLike[] | undefined,
    currencySymbol: string | undefined,
    languageCode: string,
): PaymentScheduleRowForEmail[] {
    const sorted = [...(installments ?? [])].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const hasInterest = sorted.some(i => (parseFloat(i.interestAmount?.toString() ?? "0") || 0) > 0);
    return sorted.map(i => ({
        installmentNumber: i.installmentNumber,
        dueDate: formatReservationExpirationForEmail(new Date(i.dueDate).toISOString(), languageCode) ?? "—",
        amount: money(i.amount, currencySymbol, languageCode),
        ...(hasInterest
            ? {
                  principal: money(i.principalAmount, currencySymbol, languageCode),
                  interest: money(i.interestAmount, currencySymbol, languageCode),
              }
            : {}),
    }));
}

/**
 * Down payment + installment schedule shown in the sale confirmation (client) and the staff
 * sale alert. Pass the request `session` when the plan may not be committed yet (sale creation).
 */
export async function salePlanSummaryForEmail(opts: {
    paymentPlanId?: ObjectId | string | null;
    companyId: ObjectId;
    currencySymbol?: string;
    languageCode: string;
    session?: ClientSession;
}): Promise<SalePlanSummaryForEmail> {
    const {currencySymbol, languageCode} = opts;
    const zero = {downPaymentDisplay: money("0", currencySymbol, languageCode)};
    if (!opts.paymentPlanId) return zero;

    const plan = await paymentPlanService.findOne(
        {_id: opts.paymentPlanId, company: opts.companyId},
        {session: opts.session, languageCode},
        undefined,
        "downPayment downPaymentPaid numberOfInstallments installments",
    );
    if (!plan) return zero;

    const downPayment = parseFloat(plan.downPayment?.toString() ?? "0") || 0;
    const schedule = buildPaymentScheduleForEmail(plan.installments as InstallmentLike[], currencySymbol, languageCode);
    return {
        downPaymentDisplay: money(String(downPayment), currencySymbol, languageCode),
        downPaymentPaid: downPayment > 0 ? !!plan.downPaymentPaid : undefined,
        numberOfInstallments: plan.numberOfInstallments,
        paymentSchedule: schedule.length ? schedule : undefined,
    };
}
