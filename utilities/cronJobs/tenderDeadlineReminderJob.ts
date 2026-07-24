/**
 * Daily job for Ausschreibung deadlines:
 * - Flags published tenders whose submissionDeadline is within 24h as "closing".
 * - Auto-closes tenders (published | closing → closed) once the submissionDeadline
 *   has passed (UTC end-of-day), so no bids can arrive after the deadline.
 *
 * @module utilities/cronJobs/tenderDeadlineReminderJob
 */

import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {tenderService} from "../../database/schemas/tender/tender.service";

const BATCH_SIZE = 200;

export async function runTenderDeadlineReminders(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("tender_deadline_reminder", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    logger.start("Checking tender submission deadlines...");

    const now = Date.now();
    const soon = new Date(now + 24 * 60 * 60 * 1000);
    let flagged = 0;
    let closed = 0;

    // 1) Flag published tenders entering the final 24h as "closing".
    {
        const baseFilter: Record<string, unknown> = {
            status: "published",
            submissionDeadline: {$exists: true, $ne: null, $gt: new Date(now), $lte: soon},
        };
        let lastId: ObjectId | undefined;
        while (true) {
            const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
            const rows = await tenderService.find(filter, {logger, languageCode: lang, timeOperations: false}, undefined, "_id status submissionDeadline", {_id: 1}, BATCH_SIZE, 0);
            if (rows.length === 0) break;
            lastId = rows[rows.length - 1]._id as ObjectId;
            for (const t of rows) {
                try {
                    await tenderService.updateByIdOrThrow(t._id, {$set: {status: "closing"}}, {logger, languageCode: lang, timeOperations: false});
                    flagged++;
                } catch (e: unknown) {
                    logger.err(`Tender closing flag failed for ${t._id?.toString?.()}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            if (rows.length < BATCH_SIZE) break;
        }
    }

    // 2) Auto-close tenders whose deadline has passed.
    {
        const baseFilter: Record<string, unknown> = {
            status: {$in: ["published", "closing"]},
            submissionDeadline: {$exists: true, $ne: null, $lt: new Date(now)},
        };
        let lastId: ObjectId | undefined;
        while (true) {
            const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
            const rows = await tenderService.find(filter, {logger, languageCode: lang, timeOperations: false}, undefined, "_id status submissionDeadline", {_id: 1}, BATCH_SIZE, 0);
            if (rows.length === 0) break;
            lastId = rows[rows.length - 1]._id as ObjectId;
            for (const t of rows) {
                try {
                    await tenderService.updateByIdOrThrow(t._id, {$set: {status: "closed"}}, {logger, languageCode: lang, timeOperations: false});
                    closed++;
                } catch (e: unknown) {
                    logger.err(`Tender auto-close failed for ${t._id?.toString?.()}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            if (rows.length < BATCH_SIZE) break;
        }
    }

    logger.finish(`Tender deadline check complete. Flagged ${flagged} closing, auto-closed ${closed}.`);
}
