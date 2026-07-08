/**
 * Daily job (08:12 UTC): buyer emails for upcoming installments (3d / 1d / day-of) and one overdue notice
 * after the due calendar day (UTC end-of-day), mirroring reservation expiration reminders.
 *
 * Stamps `installmentReminderEmailAt*` / `installmentOverdueNoticeEmailAt` on each installment subdocument.
 */

import {CronJob} from "cron";
import {Decimal128, ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {paymentPlanService} from "../../database/schemas/paymentPlan/paymentPlan.service";
import PaymentPlan from "../../database/schemas/paymentPlan/paymentPlan";
import {PaymentPlanStatus, InstallmentStatus} from "../../database/schemas/paymentPlan/paymentPlan";
import {
    type DispatchSaleClientEmailInput,
    dispatchSaleClientEmail,
    formatInstallmentDueDateForEmail,
} from "@propertyManagement/utilities/database/sale/saleClientEmailDispatch";
import {
    isPastExpirationUtcEndOfDay,
} from "@propertyManagement/utilities/reservation/reservationExpirationCalendar";
import {formatMoneyAmountForEmail} from "@propertyManagement/utilities/emails/reservationEmailFormatting";

const BATCH_SIZE = 200;

let installmentReminderJob: CronJob | null = null;

type ReminderPhase = "3" | "1" | "0";

function utcDueDayBounds(daysFromToday: number): {start: Date; end: Date} {
    const n = new Date();
    const t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + daysFromToday));
    const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 23, 59, 59, 999));
    return {start, end};
}

const PHASES: {
    phase: ReminderPhase;
    daysUntilDue: number;
    field: "installmentReminderEmailAt3d" | "installmentReminderEmailAt1d" | "installmentReminderEmailAt0d";
}[] = [
    {phase: "3", daysUntilDue: 3, field: "installmentReminderEmailAt3d"},
    {phase: "1", daysUntilDue: 1, field: "installmentReminderEmailAt1d"},
    {phase: "0", daysUntilDue: 0, field: "installmentReminderEmailAt0d"},
];

type InstallmentLike = {
    installmentNumber: number;
    dueDate: Date;
    status: InstallmentStatus;
    amount: {toString: () => string};
    principalAmount: {toString: () => string};
    installmentReminderEmailAt3d?: Date;
    installmentReminderEmailAt1d?: Date;
    installmentReminderEmailAt0d?: Date;
    installmentOverdueNoticeEmailAt?: Date;
};

async function stampInstallmentField(planId: ObjectId, installmentNumber: number, field: string): Promise<void> {
    await PaymentPlan.updateOne(
        {_id: planId},
        {$set: {[`installments.$[i].${field}`]: new Date()}},
        {arrayFilters: [{"i.installmentNumber": installmentNumber}]}
    );
}

function installmentEmailEligible(status: InstallmentStatus): boolean {
    return status === InstallmentStatus.PENDING || status === InstallmentStatus.PARTIALLY_PAID;
}

function buildDispatchPayload(params: {
    sale: any;
    plan: {company?: {_id?: ObjectId; name?: string} | ObjectId};
    installment: InstallmentLike;
    lang: string;
    kind: DispatchSaleClientEmailInput["kind"];
    reminderPhase?: ReminderPhase;
    daysRemaining?: number;
}): DispatchSaleClientEmailInput | null {
    const {sale, plan, installment, lang, kind, reminderPhase, daysRemaining} = params;
    const buyer = sale?.buyer;
    const buyerId = buyer?._id;
    if (!buyerId) {
        return null;
    }

    const companyFromSale = sale.company;
    const companyFromPlan = plan.company;
    const company = companyFromSale ?? companyFromPlan;
    const companyId =
        company && typeof company === "object" && "_id" in company
            ? (company as {_id: ObjectId})._id.toString()
            : company
              ? String(company)
              : "";
    const companyName = company && typeof company === "object" && "name" in company ? (company as {name?: string}).name ?? "" : "";

    if (!companyId) {
        return null;
    }

    const unit = sale.unit;
    const unitNumber = unit?.unitNumber != null ? String(unit.unitNumber) : undefined;
    const unitDisplayName = unit?.name;

    let unitPriceDisplay: string | undefined;
    if (unit?.price != null) {
        const sym = unit.priceCurrency?.symbol ?? "";
        const amt = formatMoneyAmountForEmail(unit.price.toString(), lang);
        unitPriceDisplay = sym ? `${amt} ${sym}` : amt;
    }

    const saleSym = sale.saleCurrency?.symbol ?? "";
    const finalAmt = sale.finalPrice != null ? formatMoneyAmountForEmail(sale.finalPrice.toString(), lang) : "";
    const finalPriceDisplay = saleSym ? `${finalAmt} ${saleSym}` : finalAmt;

    const dueIso = new Date(installment.dueDate).toISOString();
    const instAmt = formatMoneyAmountForEmail(installment.amount.toString(), lang);
    const installmentAmountDisplay = saleSym ? `${instAmt} ${saleSym}` : instAmt;

    const paymentType: "cash" | "payment_plan" =
        String(sale.paymentType) === "payment_plan" ? "payment_plan" : "cash";

    return {
        clientUserId: buyerId,
        languageCode: lang,
        companyId,
        companyName,
        saleId: sale._id.toString(),
        saleCode: sale.name,
        paymentType,
        unitNumber,
        unitDisplayName,
        unitPriceDisplay,
        finalPriceDisplay,
        kind,
        reminderPhase,
        daysRemaining,
        installmentNumber: installment.installmentNumber,
        installmentAmountDisplay,
        installmentDueDateIso: dueIso,
        installmentDueDateFormatted: formatInstallmentDueDateForEmail(dueIso, lang),
    };
}

export async function runPaymentPlanInstallmentReminders(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("payment_plan_installment_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

    const baseFilter = {status: PaymentPlanStatus.ACTIVE};
    const populate = [
        {path: "company", select: "name"},
        {
            path: "sale",
            populate: [
                {path: "buyer", select: "username name surname fullName"},
                {path: "unit", select: "unitNumber name price", populate: [{path: "priceCurrency", select: "symbol"}]},
                {path: "saleCurrency", select: "symbol"},
                {path: "company", select: "name"},
            ],
        },
    ];

    let lastId: ObjectId | undefined;
    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        const plans = await paymentPlanService.find(
            filter,
            {logger, languageCode: lang, timeOperations: false},
            populate,
            undefined,
            {_id: 1},
            BATCH_SIZE,
            0
        );

        if (plans.length === 0) break;
        lastId = plans[plans.length - 1]._id as ObjectId;

        for (const plan of plans) {
            const sale = plan.sale as any;
            if (!sale || !sale._id) {
                continue;
            }

            const installments = (plan.installments || []) as InstallmentLike[];
            for (const inst of installments) {
                if (!installmentEmailEligible(inst.status)) {
                    continue;
                }

                const due = new Date(inst.dueDate);
                const dueTime = due.getTime();
                if (Number.isNaN(dueTime)) {
                    continue;
                }

                for (const {phase, daysUntilDue, field} of PHASES) {
                    if ((inst as any)[field]) {
                        continue;
                    }
                    const {start, end} = utcDueDayBounds(daysUntilDue);
                    if (dueTime < start.getTime() || dueTime > end.getTime()) {
                        continue;
                    }

                    const payload = buildDispatchPayload({
                        sale,
                        plan,
                        installment: inst,
                        lang,
                        kind: "installment_reminder",
                        reminderPhase: phase,
                    });
                    if (!payload) {
                        logger.warn(`Installment reminder skipped (no buyer) plan ${plan._id} #${inst.installmentNumber}`);
                        continue;
                    }

                    try {
                        const emailed = await dispatchSaleClientEmail(payload);
                        if (!emailed) {
                            logger.warn(`Installment reminder skipped (no email) plan ${plan._id} #${inst.installmentNumber}`);
                            continue;
                        }
                        await stampInstallmentField(plan._id, inst.installmentNumber, field);
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        logger.err(`Installment reminder failed plan ${plan._id} #${inst.installmentNumber}: ${msg}`);
                    }
                }

                if (isPastExpirationUtcEndOfDay(due) && !(inst as any).installmentOverdueNoticeEmailAt) {
                    const payload = buildDispatchPayload({
                        sale,
                        plan,
                        installment: inst,
                        lang,
                        kind: "installment_overdue",
                    });
                    if (!payload) {
                        continue;
                    }
                    try {
                        const emailed = await dispatchSaleClientEmail(payload);
                        if (emailed) {
                            await stampInstallmentField(plan._id, inst.installmentNumber, "installmentOverdueNoticeEmailAt");
                        }
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        logger.err(`Installment overdue email failed plan ${plan._id}: ${msg}`);
                    }
                }
            }
        }

        if (plans.length < BATCH_SIZE) break;
    }

    await runPaymentPlanInstallmentOverdueMarkings(parentLogger);
}

async function runPaymentPlanInstallmentOverdueMarkings(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("payment_plan_installment_overdue_marking", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const now = Date.now();

    const baseFilter = {status: PaymentPlanStatus.ACTIVE};

    let lastId: ObjectId | undefined;
    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        const plans = await paymentPlanService.find(
            filter,
            {logger, languageCode: lang, timeOperations: false},
            [],
            undefined,
            {_id: 1},
            BATCH_SIZE,
            0
        );

        if (plans.length === 0) break;
        lastId = plans[plans.length - 1]._id as ObjectId;

        for (const plan of plans) {
            const graceDays = typeof plan.gracePeriodDays === "number" ? plan.gracePeriodDays : 0;
            const lateFeePercentage = typeof plan.lateFeePercentage === "number" ? plan.lateFeePercentage : 0;
            const installments = (plan.installments || []) as InstallmentLike[];

            for (const inst of installments) {
                if (inst.status !== InstallmentStatus.PENDING && inst.status !== InstallmentStatus.PARTIALLY_PAID) {
                    continue;
                }

                const dueDate = new Date(inst.dueDate);
                if (Number.isNaN(dueDate.getTime())) {
                    continue;
                }

                // Grace window: end of (dueDate + gracePeriodDays) in UTC
                const graceEndMs = Date.UTC(
                    dueDate.getUTCFullYear(),
                    dueDate.getUTCMonth(),
                    dueDate.getUTCDate() + graceDays,
                    23, 59, 59, 999
                );
                if (now <= graceEndMs) {
                    continue;
                }

                const updateFields: Record<string, unknown> = {
                    "installments.$[i].status": InstallmentStatus.OVERDUE,
                };

                if (lateFeePercentage > 0 && inst.principalAmount) {
                    const principal = parseFloat(inst.principalAmount.toString());
                    if (Number.isFinite(principal) && principal > 0) {
                        const fee = (principal * lateFeePercentage) / 100;
                        updateFields["installments.$[i].lateFeeAmount"] = Decimal128.fromString(fee.toFixed(10));
                    }
                }

                try {
                    await PaymentPlan.updateOne(
                        {_id: plan._id},
                        {$set: updateFields},
                        {arrayFilters: [{"i.installmentNumber": inst.installmentNumber, "i.status": {$in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID]}}]}
                    );
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logger.err(`Installment overdue marking failed plan ${plan._id} #${inst.installmentNumber}: ${msg}`);
                }
            }
        }

        if (plans.length < BATCH_SIZE) break;
    }
}

export function startPaymentPlanInstallmentReminderJob(parentLogger?: serverLogger): void {
    const log = getLogger("payment_plan_installment_reminder_cron", parentLogger);
    if (installmentReminderJob !== null) {
        return;
    }
    installmentReminderJob = new CronJob(
        "0 12 8 * * *",
        () => {
            void runPaymentPlanInstallmentReminders(parentLogger);
        },
        null,
        true,
        "UTC"
    );
    log.debug("Payment plan installment reminder job scheduled (cron: 0 12 8 * * * UTC)");
}

export function stopPaymentPlanInstallmentReminderJob(): void {
    if (installmentReminderJob) {
        installmentReminderJob.stop();
        installmentReminderJob = null;
    }
}
