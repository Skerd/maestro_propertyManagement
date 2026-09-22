import {ObjectId} from "mongodb";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import ConstructionProgress from "@propertyManagement/database/schemas/constructionProgress/constructionProgress";
import Company from "@coreModule/database/schemas/company/company";
import {formatReservationExpirationForEmail} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {loadInlineImageAttachments} from "@propertyManagement/utilities/emails/mediaImageAttachments";
import {sendConstructionProgressClientMail} from "@propertyManagement/utilities/emails/constructionProgressNotifiers";
import {findConstructionProgressRecipients} from "./constructionProgressRecipients";

type Ref = {_id?: ObjectId; name?: string} | ObjectId | null | undefined;

const idOf = (ref: Ref): ObjectId | undefined => (ref instanceof ObjectId ? ref : ref?._id);
const nameOf = (ref: Ref): string | undefined => (ref instanceof ObjectId ? undefined : ref?.name);
const dateText = (d: Date | undefined, lang: string) => (d ? formatReservationExpirationForEmail(new Date(d).toISOString(), lang) : undefined);

/**
 * Tells every client holding a unit in the report's scope (buyers + active reservations) about it:
 * one in-app notification + one email (with inline site photos) per client, then stamps the report.
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
        const progress = await ConstructionProgress.findById(id)
            .populate([{path: "project", select: "name"}, {path: "edifice", select: "name"}])
            .lean();
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
        const companyDoc = await Company.findById(company).select("name").lean<{name?: string}>();

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

        // Load photos once and reuse the buffers for every recipient.
        const photos = await loadInlineImageAttachments(progress.photos ?? [], {languageCode: lang, cidPrefix: "site"});

        await Promise.all(
            recipients.map(r =>
                sendConstructionProgressClientMail({
                    email: r.email,
                    fullName: r.fullName,
                    languageCode: lang,
                    companyId: company.toString(),
                    companyName: companyDoc?.name ?? "",
                    projectName,
                    edificeName,
                    unitLabels: r.units.map(u => u.unitNumber ?? u.unitName ?? "—"),
                    phase: progress.phase,
                    progressPercent: progress.progressPercent,
                    updateDateFormatted: dateText(progress.updateDate, lang),
                    expectedCompletionFormatted: dateText(progress.expectedCompletionDate, lang),
                    title: progress.title,
                    description: progress.description,
                    photos,
                }).catch((e: unknown) => {
                    console.error(`Failed to send construction progress email to ${r.userId}:`, e);
                }),
            ),
        );

        await ConstructionProgress.updateOne(
            {_id: id},
            {$set: {clientsNotifiedAt: new Date(), clientsNotifiedCount: recipients.length}},
        );
        return recipients.length;
    } catch (e) {
        console.error("Failed to notify construction progress clients:", e);
        return 0;
    }
}
