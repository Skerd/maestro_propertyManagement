/**
 * Daily job (08:14 UTC):
 * Finds modification requests where stageDueDate has passed and the request is still
 * in an active pending stage. Emits MODIFICATION_REQUEST_SLA_BREACHED notifications
 * to the requestedBy user so they (and the system) can follow up.
 *
 * @module utilities/cronJobs/modificationRequestSlaJob
 */

import {CronJob} from "cron";
import {ObjectId} from "mongodb";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {modificationRequestService} from "../../database/schemas/modificationRequest/modificationRequest.service";
import {ModificationRequestStatus} from "../../database/schemas/modificationRequest/modificationRequest";

const BATCH_SIZE = 200;

let slaJob: CronJob | null = null;

const PENDING_STAGES = [
    ModificationRequestStatus.PENDING_ARCHITECT,
    ModificationRequestStatus.PENDING_ENGINEER,
    ModificationRequestStatus.PENDING_CEO,
    ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
    ModificationRequestStatus.PENDING_ENGINEER_REVISION,
    ModificationRequestStatus.PENDING_FINANCE,
    ModificationRequestStatus.PENDING_CLIENT_APPROVAL,
    ModificationRequestStatus.PENDING_DELIVERY,
];

export async function runModificationRequestSlaEscalations(parentLogger?: serverLogger): Promise<void> {
    const log = getLogger("modification_request_sla_cron", parentLogger);
    log.start("Checking modification request SLA breaches...");

    const now = new Date();
    const baseFilter = {
        status: {$in: PENDING_STAGES},
        stageDueDate: {$lt: now},
        deletedAt: {$exists: false},
    };
    const select = "_id name title status stageDueDate requestedBy company";

    let totalEscalated = 0;
    let lastId: ObjectId | undefined;

    while (true) {
        const filter = lastId ? {...baseFilter, _id: {$gt: lastId}} : baseFilter;
        let batch: any[];
        try {
            batch = await modificationRequestService.find(
                filter,
                {logger: log, languageCode: "en-US"},
                undefined,
                select,
                {_id: 1},
                BATCH_SIZE,
                0,
            );
        } catch (e: unknown) {
            log.error(`Failed to fetch overdue modification requests: ${e instanceof Error ? e.message : String(e)}`);
            break;
        }

        if (batch.length === 0) break;
        lastId = batch[batch.length - 1]._id as ObjectId;

        log.debug(`Processing batch of ${batch.length} overdue modification request(s).`);

        for (const req of batch) {
            try {
                const requestedById = req.requestedBy?._id?.toString() ?? req.requestedBy?.toString();
                if (!requestedById) continue;

                emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_SLA_BREACHED, {
                    receiverIds: [requestedById],
                    payload: {
                        companyId: req.company?.toString() ?? "",
                        modificationRequestId: req._id.toString(),
                        title: req.title,
                        status: req.status,
                        stageDueDate: req.stageDueDate ? new Date(req.stageDueDate).toISOString() : undefined,
                        languageCode: "en-US",
                    },
                });
                totalEscalated++;
            } catch (e: unknown) {
                log.error(`Failed to emit SLA breach for modification request ${req._id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (batch.length < BATCH_SIZE) break;
    }

    log.finish(`Modification request SLA check complete. Escalated ${totalEscalated} request(s).`);
}

/**
 * Idempotent: starts a single daily cron (08:14 UTC).
 */
export function startModificationRequestSlaJob(parentLogger?: serverLogger): void {
    const log = getLogger("modification_request_sla_cron", parentLogger);
    if (slaJob !== null) return;

    slaJob = new CronJob(
        "0 14 8 * * *",
        () => { void runModificationRequestSlaEscalations(parentLogger); },
        null,
        true,
        "UTC",
    );
    log.debug("Modification request SLA job scheduled (cron: 0 14 8 * * * UTC)");
}

export function stopModificationRequestSlaJob(): void {
    if (slaJob) {
        slaJob.stop();
        slaJob = null;
    }
}
