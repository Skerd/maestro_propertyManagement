/**
 * Daily job (08:10 UTC):
 * - Email + in-app reminder for active unpaid reservations approaching expiration (3d / 1d / day-of, UTC calendar).
 * - Stamp `expiredAt` on active unpaid reservations past the expiration calendar day (UTC end-of-day).
 *
 * @module utilities/timing/reservationExpirationReminderJob
 */

import {CronJob} from "cron";
import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {reservationService} from "../../database/schemas/reservation/reservation.service";
import Unit, {UnitStatus} from "../../database/schemas/unit/unit";
import {ReservationStatus} from "../../database/schemas/reservation/reservation";
import {
    dispatchReservationClientEmail,
    formatReservationExpirationForEmail,
} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";

const BATCH_SIZE = 200;

let reminderJob: CronJob | null = null;

type ReminderPhase = "3" | "1" | "0";

function utcExpirationDayBounds(daysFromToday: number): {start: Date; end: Date} {
    const n = new Date();
    const t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + daysFromToday));
    const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 23, 59, 59, 999));
    return {start, end};
}

const PHASES: {phase: ReminderPhase; daysUntilExpiration: number; field: "expirationReminderEmailAt3d" | "expirationReminderEmailAt1d" | "expirationReminderEmailAt0d"}[] = [
    {phase: "3", daysUntilExpiration: 3, field: "expirationReminderEmailAt3d"},
    {phase: "1", daysUntilExpiration: 1, field: "expirationReminderEmailAt1d"},
    {phase: "0", daysUntilExpiration: 0, field: "expirationReminderEmailAt0d"},
];

/** End of the expiration calendar day in UTC (23:59:59.999). */
function endOfUtcCalendarDayForExpiration(d: Date): number {
    const x = new Date(d);
    return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 23, 59, 59, 999);
}

/**
 * Marks unpaid active reservations as expired the first time we observe them past
 * the expiration day's end (UTC), so the sheet can show an "expired" milestone.
 */
export async function runReservationExpiredStamp(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("reservation_expired_stamp", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const now = Date.now();

    const baseFilter: Record<string, unknown> = {
        isActive: true,
        paid: false,
        expirationDate: {$exists: true, $ne: null},
        expiredAt: {$exists: false},
    };

    let lastId: ObjectId | undefined;
    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        const rows = await reservationService.find(
            filter,
            {logger, languageCode: lang, timeOperations: false},
            undefined,
            undefined,
            {_id: 1},
            BATCH_SIZE,
            0
        );

        if (rows.length === 0) break;
        lastId = rows[rows.length - 1]._id as ObjectId;

        for (const res of rows) {
            if (!res.expirationDate) {
                continue;
            }
            if (now <= endOfUtcCalendarDayForExpiration(new Date(res.expirationDate))) {
                continue;
            }
            try {
                await reservationService.updateByIdOrThrow(
                    res._id,
                    {$set: {expiredAt: new Date(), status: ReservationStatus.EXPIRED}},
                    {logger, languageCode: lang, timeOperations: false}
                );
                await Unit.updateOne(
                    {_id: res.unit, status: UnitStatus.RESERVED, reservation: res._id},
                    {$set: {status: UnitStatus.AVAILABLE}, $unset: {reservation: ""}}
                );
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                logger.err(`Reservation expired stamp failed for ${res._id?.toString?.()}: ${msg}`);
            }
        }

        if (rows.length < BATCH_SIZE) break;
    }
}

export async function runReservationExpirationReminders(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("reservation_expiration_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

    for (const {phase, daysUntilExpiration, field} of PHASES) {
        const {start, end} = utcExpirationDayBounds(daysUntilExpiration);

        const baseFilter: Record<string, unknown> = {
            isActive: true,
            paid: false,
            expirationDate: {$gte: start, $lte: end},
            [field]: {$exists: false},
        };

        let lastId: ObjectId | undefined;
        while (true) {
            const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
            const rows = await reservationService.find(
                filter,
                {logger, languageCode: lang, timeOperations: false},
                [
                    {path: "client", select: "username name surname fullName"},
                    {path: "company", select: "name"},
                    {path: "unit", select: "unitNumber"},
                ],
                undefined,
                {_id: 1},
                BATCH_SIZE,
                0
            );

            if (rows.length === 0) break;
            lastId = rows[rows.length - 1]._id as ObjectId;

            for (const res of rows) {
                const clientId = res.client?._id?.toString();
                const companyId = res.company?._id?.toString();
                if (!clientId || !companyId || !res.expirationDate) {
                    continue;
                }

                const companyName = res.company?.name;
                const unitNumber = res.unit?.unitNumber;
                const expIso = new Date(res.expirationDate).toISOString();

                try {
                    const emailed = await dispatchReservationClientEmail({
                        clientUserId: clientId,
                        kind: "expiration_reminder",
                        reminderPhase: phase,
                        languageCode: lang,
                        companyId,
                        companyName,
                        reservationId: res._id.toString(),
                        reservationCode: res.name,
                        unitNumber: unitNumber != null ? String(unitNumber) : undefined,
                        expirationDateIso: expIso,
                        expirationDateFormatted: formatReservationExpirationForEmail(expIso, lang),
                    });

                    if (!emailed) {
                        logger.warn(
                            `Reservation reminder skipped (no client email) for ${res._id?.toString?.()} phase ${phase}`
                        );
                        continue;
                    }

                    emitNotificationEvent(NotificationEventCodes.RESERVATION_EXPIRATION_REMINDER, {
                        receiverIds: [clientId],
                        payload: {
                            companyId,
                            reservationId: res._id.toString(),
                            unitNumber: unitNumber != null ? String(unitNumber) : undefined,
                            expirationDate: expIso,
                            reminderPhase: phase,
                            languageCode: lang,
                        },
                    });

                    await reservationService.updateByIdOrThrow(
                        res._id,
                        {$set: {[field]: new Date()}},
                        {logger, languageCode: lang, timeOperations: false}
                    );
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logger.err(`Reservation reminder failed for ${res._id?.toString?.()}: ${msg}`);
                }
            }

            if (rows.length < BATCH_SIZE) break;
        }
    }

    await runReservationExpiredStamp(parentLogger);
}

/**
 * Idempotent: starts a single daily cron (08:10 UTC).
 */
export function startReservationExpirationReminderJob(parentLogger?: serverLogger): void {
    const log = getLogger("reservation_expiration_reminder_cron", parentLogger);
    if (reminderJob !== null) {
        return;
    }
    reminderJob = new CronJob(
        "0 10 8 * * *",
        () => {
            void runReservationExpirationReminders(parentLogger);
        },
        null,
        true,
        "UTC"
    );
    log.debug("Reservation expiration reminder job scheduled (cron: 0 10 8 * * * UTC)");
}

export function stopReservationExpirationReminderJob(): void {
    if (reminderJob) {
        reminderJob.stop();
        reminderJob = null;
    }
}
