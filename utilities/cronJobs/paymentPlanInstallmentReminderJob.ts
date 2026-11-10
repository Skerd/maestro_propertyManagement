/**
 * Daily job (08:12 UTC): buyer emails for upcoming installments (3d / 1d / day-of) and one overdue notice
 * after the due calendar day, mirroring reservation expiration reminders.
 *
 * "Today" is the calendar day in the company timezone (GLB-09, D91); `dueDate` is a calendar value stored at
 * midnight UTC, so its day is read in UTC.
 *
 * Stamps `installmentReminderEmailAt*` / `installmentOverdueNoticeEmailAt` on each installment subdocument.
 */

import {Decimal128, ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {paymentPlanService} from "../../database/schemas/paymentPlan/paymentPlan.service";
import {PaymentPlanStatus, InstallmentStatus} from "../../database/schemas/paymentPlan/paymentPlan";
import {
    type DispatchSaleClientEmailInput,
    dispatchSaleClientEmail,
    formatInstallmentDueDateForEmail,
} from "@propertyManagement/utilities/database/sale/saleClientEmailDispatch";
import {addLocalDays, localDateOf} from "@coreModule/utilities/time/timeWindows";
import {companyTimeZoneOf} from "@coreModule/utilities/time/companyTimeZone";
import {
    formatMoneyAmountForEmail,
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";

const BATCH_SIZE = 200;


type ReminderPhase = "3" | "1" | "0";

/** When the job runs; tests pin it. "Today" is taken in the company's timezone (D91). */
export type InstallmentReminderClock = {now?: Date};

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
    await paymentPlanService.updateInstallments({_id: planId}, {$set: {[`installments.$[i].${field}`]: new Date()}}, [{"i.installmentNumber": installmentNumber}]);
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
    const location = unitLocationForEmail(unit);

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
        ...location,
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

export async function runPaymentPlanInstallmentReminders(company: ObjectId, parentLogger?: serverLogger, clock: InstallmentReminderClock = {}): Promise<void> {
    const logger = getLogger("payment_plan_installment_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const today = localDateOf(clock.now ?? new Date(), await companyTimeZoneOf(company));

    const baseFilter = {company, status: PaymentPlanStatus.ACTIVE};
    const populate = [
        {path: "company", select: "name"},
        {
            path: "sale",
            populate: [
                {path: "buyer", select: "username name surname fullName"},
                {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
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
                if (Number.isNaN(due.getTime())) {
                    continue;
                }
                const dueDay = localDateOf(due, "UTC");

                for (const {phase, daysUntilDue, field} of PHASES) {
                    if ((inst as any)[field]) {
                        continue;
                    }
                    if (dueDay !== addLocalDays(today, daysUntilDue)) {
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

                if (dueDay < today && !(inst as any).installmentOverdueNoticeEmailAt) {
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

    await runPaymentPlanInstallmentOverdueMarkings(company, parentLogger, today);
}

async function runPaymentPlanInstallmentOverdueMarkings(company: ObjectId, parentLogger: serverLogger | undefined, today: string): Promise<void> {
    const logger = getLogger("payment_plan_installment_overdue_marking", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

    const baseFilter = {company, status: PaymentPlanStatus.ACTIVE};

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

                // Overdue once the last grace day (due day + gracePeriodDays) is before the company's today.
                if (addLocalDays(localDateOf(dueDate, "UTC"), graceDays) >= today) {
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
                    await paymentPlanService.updateInstallments({_id: plan._id}, {$set: updateFields}, [{"i.installmentNumber": inst.installmentNumber, "i.status": {$in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID]}}]);
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logger.err(`Installment overdue marking failed plan ${plan._id} #${inst.installmentNumber}: ${msg}`);
                }
            }
        }

        if (plans.length < BATCH_SIZE) break;
    }
}
