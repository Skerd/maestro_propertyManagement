/**
 * Daily job:
 * Finds milestones whose `plannedEnd` has passed while still in an active state
 * (`planned` or `in_progress`), stamps them as `delayed`, and emits a
 * MILESTONE_SLIPPING notification to the milestone creator so the slippage is
 * surfaced. Idempotent: once a milestone is `delayed` it no longer matches.
 *
 * @module utilities/cronJobs/milestoneSlippageJob
 */

import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {milestoneService} from "../../database/schemas/milestone/milestone.service";

const BATCH_SIZE = 200;

const ACTIVE_STATUSES = ["planned", "in_progress"];

export async function runMilestoneSlippageReminders(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("milestone_slippage_cron", parentLogger);
    const lang = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

    logger.start("Checking milestones for slippage...");

    const now = new Date();
    const baseFilter: Record<string, unknown> = {
        status: {$in: ACTIVE_STATUSES},
        plannedEnd: {$exists: true, $ne: null, $lt: now},
        deletedAt: {$exists: false},
    };
    const select = "_id name title status plannedEnd project company createdBy";

    let totalDelayed = 0;
    let lastId: ObjectId | undefined;

    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;

        let batch: any[];
        try {
            batch = await milestoneService.find(
                filter,
                {logger, languageCode: lang, timeOperations: false},
                [{path: "project", select: "name"}, {path: "createdBy", select: "name surname"}],
                select,
                {_id: 1},
                BATCH_SIZE,
                0,
            );
        } catch (e: unknown) {
            logger.err(`Failed to fetch slipping milestones: ${e instanceof Error ? e.message : String(e)}`);
            break;
        }

        if (batch.length === 0) break;
        lastId = batch[batch.length - 1]._id as ObjectId;

        for (const milestone of batch) {
            const companyId = milestone.company?.toString?.();
            const receiverId = (milestone.createdBy as any)?._id?.toString() ?? milestone.createdBy?.toString();

            try {
                await milestoneService.updateByIdOrThrow(
                    milestone._id,
                    {$set: {status: "delayed"}},
                    {logger, languageCode: lang, timeOperations: false},
                );

                if (companyId && receiverId) {
                    emitNotificationEvent(NotificationEventCodes.MILESTONE_SLIPPING, {
                        receiverIds: [receiverId],
                        payload: {
                            companyId,
                            milestoneId: milestone._id.toString(),
                            title: milestone.title,
                            projectId: (milestone.project as any)?._id?.toString() ?? milestone.project?.toString(),
                            plannedEnd: milestone.plannedEnd ? new Date(milestone.plannedEnd).toISOString() : undefined,
                            languageCode: lang,
                        },
                    });
                }

                totalDelayed++;
            } catch (e: unknown) {
                logger.err(`Milestone slippage update failed for ${milestone._id?.toString?.()}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (batch.length < BATCH_SIZE) break;
    }

    logger.finish(`Milestone slippage check complete. Marked ${totalDelayed} milestone(s) as delayed.`);
}
