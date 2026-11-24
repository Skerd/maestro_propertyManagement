import {ObjectId} from "mongodb";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {filterUnmutedReceivers} from "@coreModule/domain/notifications/notificationDomainService";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {formatReservationExpirationForEmail} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {loadInlineImageAttachments, type InlineImageAttachment} from "@propertyManagement/utilities/emails/mediaImageAttachments";
import {dispatchConstructionProgressClientEmail} from "@propertyManagement/utilities/emails/emailDispatch";
import {emailEventType} from "@coreModule/kafka/kafkaProducer";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {findConstructionProgressRecipients} from "./constructionProgressRecipients";
import {getLogger} from "@coreModule/loggers/serverLog";

import {constructionProgressService} from "@propertyManagement/database/schemas/constructionProgress/constructionProgress.service";
import {companyService} from "@coreModule/database/schemas/company/company.service";
const logger = getLogger("construction_progress_notify");

type Ref = {_id?: ObjectId; name?: string} | ObjectId | null | undefined;

const idOf = (ref: Ref): ObjectId | undefined => (ref instanceof ObjectId ? ref : ref?._id);
const nameOf = (ref: Ref): string | undefined => (ref instanceof ObjectId ? undefined : ref?.name);
const dateText = (day: string | undefined, lang: string) => (day ? formatReservationExpirationForEmail(day, lang) : undefined);

/**
 * Tells every client holding a unit in the report's scope (buyers + active reservations) about it:
 * one in-app notification + one email (with inline site photos, through its Kafka topic, D188) per client, then stamps the report. Each email is
 * written in its client's language (D128); `opts.languageCode` (the staff member's) only goes in the in-app payload.
 *
 * Best-effort: never throws, so a failing notification cannot break the save that triggered it.
 * @returns how many clients were notified (0 when nobody is in scope, the report is gone, or on failure).
 */
export async function notifyConstructionProgressClients(
    progressId: ObjectId | string,
    opts: {languageCode: string},
): Promise<number> {
    try {
        const id = typeof progressId === "string" ? new ObjectId(progressId) : progressId;
        const progress = await constructionProgressService.findWithProjectAndEdificeLean(id);
        if (!progress) return 0;

        const company = progress.company as unknown as ObjectId;
        const project = idOf(progress.project as Ref);
        if (!project) return 0;
        const edifice = idOf(progress.edifice as Ref);

        const recipients = await findConstructionProgressRecipients({company, project, edifice});
        if (!recipients.length) return 0;

        const lang = opts.languageCode;
        const projectName = nameOf(progress.project as Ref) ?? "";
        const edificeName = nameOf(progress.edifice as Ref);
        const companyDoc = await companyService.findById(company, {}, undefined, "name");

        emitNotificationEvent(NotificationEventCodes.CONSTRUCTION_PROGRESS_UPDATE, {
            receiverIds: recipients.map(r => r.userId),
            payload: {
                companyId: company.toString(),
                constructionProgressId: id.toString(),
                projectId: project.toString(),
                projectName,
                edificeName,
                phase: progress.phase,
                progressPercent: progress.progressPercent,
                // Per-receiver unit labels, so each notification names that client's own units.
                unitLabelsByUser: Object.fromEntries(
                    recipients.map(r => [r.userId, r.units.map(u => u.unitNumber ?? u.unitName ?? "").filter(Boolean)]),
                ),
                languageCode: lang,
            },
        });

        // A client who turned these updates off (D117) gets neither the notice nor the email.
        const emailed = new Set(await filterUnmutedReceivers(recipients.map(r => r.userId), company, NotificationEventCodes.CONSTRUCTION_PROGRESS_UPDATE));

        // Each email goes through Kafka with the photos' ids (D188); a direct send loads them once for every recipient.
        const photoIds = (progress.photos ?? []).flatMap((photo: unknown) => {
            const photoId = nestedEntityToRef(photo);
            return photoId ? [photoId.toString()] : [];
        });
        let photos: Promise<InlineImageAttachment[]> | undefined;
        const loadPhotos = () => (photos ??= loadInlineImageAttachments(photoIds, {languageCode: lang, cidPrefix: "site"}));

        await Promise.all(
            recipients.filter(r => emailed.has(r.userId)).map(r =>
                dispatchConstructionProgressClientEmail({
                    eventType: emailEventType("CONSTRUCTION_PROGRESS_CLIENT_EMAIL"),
                    timestamp: Date.now(),
                    constructionProgressId: id.toString(),
                    photoIds,
                    email: r.email,
                    fullName: r.fullName,
                    languageCode: r.languageCode,
                    companyId: company.toString(),
                    companyName: companyDoc?.name ?? "",
                    projectName,
                    edificeName,
                    unitLabels: r.units.map(u => u.unitNumber ?? u.unitName ?? "—"),
                    phase: progress.phase,
                    progressPercent: progress.progressPercent,
                    updateDateFormatted: dateText(progress.updateDate, r.languageCode),
                    expectedCompletionFormatted: dateText(progress.expectedCompletionDate, r.languageCode),
                    title: progress.title,
                    description: progress.description,
                }, loadPhotos).catch((e: unknown) => {
                    logger.err(`Failed to send construction progress email to ${r.userId}:`, e);
                }),
            ),
        );

        await constructionProgressService.updateOne({_id: id}, {$set: {clientsNotifiedAt: new Date(), clientsNotifiedCount: recipients.length}});
        return recipients.length;
    } catch (e) {
        logger.err("Failed to notify construction progress clients:", e);
        return 0;
    }
}
