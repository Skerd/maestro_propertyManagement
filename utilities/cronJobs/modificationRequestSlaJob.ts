/**
 * Daily job (08:14 UTC):
 * Finds modification requests where stageDueDate has passed and the request is still
 * in an active pending stage. Emits MODIFICATION_REQUEST_SLA_BREACHED notifications
 * to the requestedBy user so they (and the system) can follow up.
 *
 * @module utilities/cronJobs/modificationRequestSlaJob
 */

import {ObjectId} from "mongodb";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {modificationRequestService} from "../../database/schemas/modificationRequest/modificationRequest.service";
import ModificationRequest, {ModificationRequestStatus} from "../../database/schemas/modificationRequest/modificationRequest";
import {companyMemberIdsWithPermission} from "@coreModule/domain/roles/companyPermissionHolders";
import {actionPermissionTag} from "@coreModule/utilities/security/actionPermissions";

/**
 * Who must move an overdue request on: the holders of the action its stage waits for (admins included). A request
 * waiting on the client goes to the approvers, who chase the client. TD-B243: the alert went to the client, so the
 * staff who should act on a breached SLA were never told.
 */
const STAGE_ACTION: Partial<Record<ModificationRequestStatus, string>> = {
    [ModificationRequestStatus.PENDING_ARCHITECT]: "approve",
    [ModificationRequestStatus.PENDING_ENGINEER]: "approve",
    [ModificationRequestStatus.PENDING_CEO]: "approve",
    [ModificationRequestStatus.PENDING_ARCHITECT_REVISION]: "submitRevision",
    [ModificationRequestStatus.PENDING_ENGINEER_REVISION]: "submitRevision",
    [ModificationRequestStatus.PENDING_FINANCE]: "finance",
    [ModificationRequestStatus.PENDING_CLIENT_APPROVAL]: "approve",
    [ModificationRequestStatus.PENDING_DELIVERY]: "deliver",
};

const BATCH_SIZE = 200;


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

export async function runModificationRequestSlaEscalations(company: ObjectId, parentLogger?: serverLogger): Promise<void> {
    const log = getLogger("modification_request_sla_cron", parentLogger);
    log.start("Checking modification request SLA breaches...");

    const now = new Date();
    const baseFilter = {
        company,
        status: {$in: PENDING_STAGES},
        stageDueDate: {$lt: now},
        deletedAt: null,
    };
    const select = "_id name title status stageDueDate company";
    // One lookup per action for the whole run.
    const holdersByAction = new Map<string, Promise<string[]>>();
    const holdersOf = (status: ModificationRequestStatus) => {
        const action = STAGE_ACTION[status] ?? "approve";
        if (!holdersByAction.has(action)) {
            holdersByAction.set(action, companyMemberIdsWithPermission(company, actionPermissionTag(ModificationRequest, action, "self")));
        }
        return holdersByAction.get(action)!;
    };

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
            log.err(`Failed to fetch overdue modification requests: ${e instanceof Error ? e.message : String(e)}`);
            break;
        }

        if (batch.length === 0) break;
        lastId = batch[batch.length - 1]._id as ObjectId;

        log.debug(`Processing batch of ${batch.length} overdue modification request(s).`);

        for (const req of batch) {
            try {
                const receiverIds = await holdersOf(req.status);
                if (receiverIds.length === 0) continue;

                emitNotificationEvent(NotificationEventCodes.MODIFICATION_REQUEST_SLA_BREACHED, {
                    receiverIds,
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
                log.err(`Failed to emit SLA breach for modification request ${req._id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (batch.length < BATCH_SIZE) break;
    }

    log.finish(`Modification request SLA check complete. Escalated ${totalEscalated} request(s).`);
}
