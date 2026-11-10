/**
 * Daily job (08:14 UTC): tenant emails for upcoming rent (3d / 1d / day-of) and one overdue notice
 * after the due calendar day, cloned from payment-plan installment reminders.
 *
 * "Today" is the calendar day in the company timezone (GLB-09, D91); `dueDate` is a calendar value stored at
 * midnight UTC, so its day is read in UTC.
 *
 * Stamps `rentReminderEmailAt*` / `rentOverdueNoticeEmailAt` only after a successful send.
 */

import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {rentalPaymentService} from "../../database/schemas/rentalPayment/rentalPayment.service";
import {LeaseStatus} from "../../database/schemas/lease/lease";
import {
    buildLeaseRentEmailPayload,
    dispatchLeaseClientEmail,
} from "@propertyManagement/utilities/database/lease/leaseClientEmailDispatch";
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {companyTodayOf} from "@coreModule/utilities/time/companyTimeZone";
import {
    isSettledRemaining,
    OPEN_RENT_STATUSES,
    remainingScaled,
} from "@propertyManagement/utilities/lease/rentRemaining";
import {
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";

const BATCH_SIZE = 200;


type ReminderPhase = "3" | "1" | "0";

/** When the job runs; tests pin it. "Today" is taken in the company's timezone (D91). */
export type LeaseRentReminderClock = {now?: Date};

const PHASES: {
    phase: ReminderPhase;
    daysUntilDue: number;
    field: "rentReminderEmailAt3d" | "rentReminderEmailAt1d" | "rentReminderEmailAt0d";
}[] = [
    {phase: "3", daysUntilDue: 3, field: "rentReminderEmailAt3d"},
    {phase: "1", daysUntilDue: 1, field: "rentReminderEmailAt1d"},
    {phase: "0", daysUntilDue: 0, field: "rentReminderEmailAt0d"},
];

function companyFromLease(lease: {
    company?: {_id?: ObjectId; name?: string} | ObjectId;
}): {companyId: string; companyName: string} | null {
    const company = lease.company;
    const companyId =
        company && typeof company === "object" && "_id" in company
            ? (company as {_id: ObjectId})._id.toString()
            : company
              ? String(company)
              : "";
    const companyName =
        company && typeof company === "object" && "name" in company
            ? ((company as {name?: string}).name ?? "")
            : "";
    if (!companyId) return null;
    return {companyId, companyName};
}

export async function runLeaseRentReminders(company: ObjectId, parentLogger?: serverLogger, clock: LeaseRentReminderClock = {}): Promise<void> {
    const logger = getLogger("lease_rent_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const today = await companyTodayOf(company, {now: clock.now});

    const baseFilter = {
        company,
        status: {$in: [...OPEN_RENT_STATUSES]},
    };
    const populate = [
        {
            path: "lease",
            select: "name status tenant company unit",
            populate: [
                {path: "tenant", select: "username name surname fullName"},
                {path: "company", select: "name"},
            ],
        },
        {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
        {path: "currency", select: "symbol"},
    ];

    let lastId: ObjectId | undefined;
    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        const payments = await rentalPaymentService.find(
            filter,
            {logger, languageCode: lang, timeOperations: false, withDeleted: false},
            populate,
            undefined,
            {_id: 1},
            BATCH_SIZE,
            0,
        );

        if (payments.length === 0) break;
        lastId = payments[payments.length - 1]._id as ObjectId;

        for (const payment of payments) {
            if (isSettledRemaining(remainingScaled(payment))) {
                continue;
            }

            const lease = payment.lease as {
                _id?: ObjectId;
                name?: string;
                status?: string;
                tenant?: unknown;
                company?: {_id?: ObjectId; name?: string} | ObjectId;
                unit?: unknown;
            } | null;
            if (!lease?._id || lease.status !== LeaseStatus.ACTIVE) {
                continue;
            }

            const company = companyFromLease(lease);
            if (!company) {
                continue;
            }

            const dueDay = payment.dueDate;
            if (!dueDay) {
                continue;
            }

            for (const {phase, daysUntilDue, field} of PHASES) {
                if (payment[field]) {
                    continue;
                }
                if (dueDay !== addLocalDays(today, daysUntilDue)) {
                    continue;
                }

                const payload = buildLeaseRentEmailPayload({
                    lease: {
                        _id: lease._id,
                        name: lease.name,
                        tenant: lease.tenant as never,
                        company: lease.company,
                        unit: lease.unit,
                    },
                    payment,
                    languageCode: lang,
                    companyId: company.companyId,
                    companyName: company.companyName,
                    kind: "rent_reminder",
                    reminderPhase: phase,
                });
                if (!payload) {
                    logger.warn(`Rent reminder skipped (no tenant) payment ${payment._id}`);
                    continue;
                }

                try {
                    const emailed = await dispatchLeaseClientEmail(payload);
                    if (!emailed) {
                        logger.warn(`Rent reminder skipped (no email) payment ${payment._id}`);
                        continue;
                    }
                    await rentalPaymentService.updateOne({_id: payment._id}, {$set: {[field]: new Date()}});
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logger.err(`Rent reminder failed payment ${payment._id}: ${msg}`);
                }
            }

            if (dueDay < today && !payment.rentOverdueNoticeEmailAt) {
                const payload = buildLeaseRentEmailPayload({
                    lease: {
                        _id: lease._id,
                        name: lease.name,
                        tenant: lease.tenant as never,
                        company: lease.company,
                        unit: lease.unit,
                    },
                    payment,
                    languageCode: lang,
                    companyId: company.companyId,
                    companyName: company.companyName,
                    kind: "rent_overdue",
                });
                if (!payload) {
                    continue;
                }
                try {
                    const emailed = await dispatchLeaseClientEmail(payload);
                    if (emailed) {
                        await rentalPaymentService.updateOne({_id: payment._id}, {$set: {rentOverdueNoticeEmailAt: new Date()}});
                    }
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logger.err(`Rent overdue email failed payment ${payment._id}: ${msg}`);
                }
            }
        }

        if (payments.length < BATCH_SIZE) break;
    }
}
