/**
 * Daily job:
 * - Emits PERMIT_EXPIRING reminders for approved permits whose `expiresAt` falls within
 *   30 / 7 / 3 / 0 days from today (UTC calendar), each phase fired at most once.
 * - Stamps `status: "expired"` on approved permits once `expiresAt` has passed the
 *   expiration calendar day (UTC end-of-day).
 *
 * @module utilities/cronJobs/permitExpiryReminderJob
 */

import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {permitService} from "../../database/schemas/permit/permit.service";

const BATCH_SIZE = 200;

type ReminderPhase = "30" | "7" | "3" | "0";
type ReminderField =
    | "expiryReminderSentAt30d"
    | "expiryReminderSentAt7d"
    | "expiryReminderSentAt3d"
    | "expiryReminderSentAt0d";

const PHASES: {phase: ReminderPhase; daysUntilExpiration: number; field: ReminderField}[] = [
    {phase: "30", daysUntilExpiration: 30, field: "expiryReminderSentAt30d"},
    {phase: "7",  daysUntilExpiration: 7,  field: "expiryReminderSentAt7d"},
    {phase: "3",  daysUntilExpiration: 3,  field: "expiryReminderSentAt3d"},
    {phase: "0",  daysUntilExpiration: 0,  field: "expiryReminderSentAt0d"},
];

function utcDayBounds(daysFromToday: number): {start: Date; end: Date} {
    const n = new Date();
    const t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + daysFromToday));
    const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 23, 59, 59, 999));
    return {start, end};
}

/** End of the expiration calendar day in UTC (23:59:59.999). */
function endOfUtcCalendarDay(d: Date): number {
    const x = new Date(d);
    return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 23, 59, 59, 999);
}

/**
 * Marks approved permits as expired the first time we observe them past
 * the expiration day's end (UTC).
 */
async function runPermitExpiredStamp(logger: serverLogger, lang: string): Promise<void> {
    const now = Date.now();

    const baseFilter: Record<string, unknown> = {
        status: "approved",
        expiresAt: {$exists: true, $ne: null},
    };

    let lastId: ObjectId | undefined;
    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        const rows = await permitService.find(
            filter,
            {logger, languageCode: lang, timeOperations: false},
            undefined,
            "_id status expiresAt",
            {_id: 1},
            BATCH_SIZE,
            0
        );

        if (rows.length === 0) break;
        lastId = rows[rows.length - 1]._id as ObjectId;

        for (const permit of rows) {
            if (!permit.expiresAt) continue;
            if (now <= endOfUtcCalendarDay(new Date(permit.expiresAt))) continue;

            try {
                await permitService.updateByIdOrThrow(
                    permit._id,
                    {$set: {status: "expired"}},
                    {logger, languageCode: lang, timeOperations: false}
                );
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                logger.err(`Permit expired stamp failed for ${permit._id?.toString?.()}: ${msg}`);
            }
        }

        if (rows.length < BATCH_SIZE) break;
    }
}

export async function runPermitExpiryReminders(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("permit_expiry_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

    logger.start("Checking permits nearing expiration...");
    let totalReminded = 0;

    for (const {phase, daysUntilExpiration, field} of PHASES) {
        const {start, end} = utcDayBounds(daysUntilExpiration);

        const baseFilter: Record<string, unknown> = {
            status: "approved",
            expiresAt: {$gte: start, $lte: end},
            [field]: {$exists: false},
        };

        let lastId: ObjectId | undefined;
        while (true) {
            const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
            const rows = await permitService.find(
                filter,
                {logger, languageCode: lang, timeOperations: false},
                [{path: "project", select: "name"}, {path: "createdBy", select: "name surname"}],
                undefined,
                {_id: 1},
                BATCH_SIZE,
                0
            );

            if (rows.length === 0) break;
            lastId = rows[rows.length - 1]._id as ObjectId;

            for (const permit of rows) {
                const companyId = permit.company?.toString?.();
                const receiverId = (permit.createdBy as any)?._id?.toString() ?? permit.createdBy?.toString();
                if (!companyId || !receiverId || !permit.expiresAt) continue;

                try {
                    emitNotificationEvent(NotificationEventCodes.PERMIT_EXPIRING, {
                        receiverIds: [receiverId],
                        payload: {
                            companyId,
                            permitId: permit._id.toString(),
                            title: permit.title,
                            projectId: (permit.project as any)?._id?.toString() ?? permit.project?.toString(),
                            expiresAt: new Date(permit.expiresAt).toISOString(),
                            reminderPhase: phase,
                            languageCode: lang,
                        },
                    });

                    await permitService.updateByIdOrThrow(
                        permit._id,
                        {$set: {[field]: new Date()}},
                        {logger, languageCode: lang, timeOperations: false}
                    );
                    totalReminded++;
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    logger.err(`Permit expiry reminder failed for ${permit._id?.toString?.()}: ${msg}`);
                }
            }

            if (rows.length < BATCH_SIZE) break;
        }
    }

    await runPermitExpiredStamp(logger, lang);

    logger.finish(`Permit expiry reminder check complete. Reminded ${totalReminded} permit(s).`);
}
