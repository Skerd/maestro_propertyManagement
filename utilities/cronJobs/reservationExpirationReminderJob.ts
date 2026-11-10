/**
 * Daily job (08:10 UTC):
 * - Email + in-app reminder for active unpaid reservations approaching expiration (3d / 1d / day-of).
 * - Ends active unpaid reservations whose expiration day is over (`endReservation`: expired, commission voided, unit freed).
 *
 * "Today" is the calendar day in the company timezone (GLB-09, D91). `expirationDate` is a calendar value stored at
 * midnight UTC, so its day is read in UTC. Each reservation is ended in its own transaction, so one failure does not
 * stop the company's sweep.
 *
 * @module utilities/timing/reservationExpirationReminderJob
 */

import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {companyTodayOf} from "@coreModule/utilities/time/companyTimeZone";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {reservationService} from "../../database/schemas/reservation/reservation.service";
import {ReservationStatus} from "../../database/schemas/reservation/reservation";
import {endReservation} from "../../database/schemas/reservation/reservation.helper";
import {
    dispatchReservationClientEmail,
    formatReservationExpirationForEmail,
} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";

const BATCH_SIZE = 200;


type ReminderPhase = "3" | "1" | "0";

/** When the job runs; tests pin it. "Today" is taken in the company's timezone (D91). */
export type ReservationExpiryClock = {now?: Date};

const PHASES: {phase: ReminderPhase; daysUntilExpiration: number; field: "expirationReminderEmailAt3d" | "expirationReminderEmailAt1d" | "expirationReminderEmailAt0d"}[] = [
    {phase: "3", daysUntilExpiration: 3, field: "expirationReminderEmailAt3d"},
    {phase: "1", daysUntilExpiration: 1, field: "expirationReminderEmailAt1d"},
    {phase: "0", daysUntilExpiration: 0, field: "expirationReminderEmailAt0d"},
];

/**
 * Ends unpaid active reservations whose expiration day is before `today` (the company's calendar day), each in its
 * own transaction.
 */
export async function runReservationExpiredStamp(company: ObjectId, parentLogger: serverLogger | undefined, today: string): Promise<void> {
    const logger = getLogger("reservation_expired_stamp", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

    const baseFilter: Record<string, unknown> = {
        company,
        isActive: true,
        paid: false,
        status: ReservationStatus.ACTIVE,
        // Expiration days are local `YYYY-MM-DD` strings (D115): they compare as text with the company's today.
        expirationDate: {$lt: today},
    };

    let ended = 0;
    let lastId: ObjectId | undefined;
    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        const rows = await reservationService.find(
            filter,
            {logger, languageCode: lang, timeOperations: false},
            undefined,
            "_id",
            {_id: 1},
            BATCH_SIZE,
            0
        );

        if (rows.length === 0) break;
        lastId = rows[rows.length - 1]._id as ObjectId;

        for (const {_id} of rows) {
            try {
                const done = await runInTransaction(logger, async (session) => {
                    // Re-read inside the transaction: it may have been paid or cancelled meanwhile.
                    const reservation = await reservationService.findOne(
                        {_id, company, isActive: true, paid: false, status: ReservationStatus.ACTIVE},
                        {session, logger, languageCode: lang, timeOperations: false},
                    );
                    if (!reservation) return false;
                    await endReservation(reservation, {status: ReservationStatus.EXPIRED}, {session, logger, languageCode: lang, companyId: company});
                    return true;
                });
                if (done) ended += 1;
            } catch (e: unknown) {
                logger.err(`Reservation expiry failed for ${_id.toString()}`, e);
            }
        }

        if (rows.length < BATCH_SIZE) break;
    }
    logger.debug(`Expired ${ended} reservation(s)`);
}

export async function runReservationExpirationReminders(company: ObjectId, parentLogger?: serverLogger, clock: ReservationExpiryClock = {}): Promise<void> {
    const logger = getLogger("reservation_expiration_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const today = await companyTodayOf(company, {now: clock.now});

    for (const {phase, daysUntilExpiration, field} of PHASES) {
        const baseFilter: Record<string, unknown> = {
            company,
            isActive: true,
            paid: false,
            expirationDate: addLocalDays(today, daysUntilExpiration),
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
                    {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
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
                const expIso = res.expirationDate;
                const location = unitLocationForEmail(res.unit);

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
                        unitDisplayName: res.unit?.name,
                        ...location,
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

    await runReservationExpiredStamp(company, parentLogger, today);
}
