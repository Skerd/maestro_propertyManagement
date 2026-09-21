import {ObjectId, type ClientSession} from "mongodb";
import User from "@coreModule/database/schemas/user/user";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {propertyManagementConfigService} from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {sendSalesStaffAlertMail} from "@propertyManagement/utilities/emails/staffAlertNotifiers";
import type {PaymentScheduleRowForEmail} from "@propertyManagement/utilities/emails/salePlanSummaryForEmail";

/**
 * Staff alerts for new sales / reservations, addressed to the users configured under
 * Sales & handover → Notifications (PropertyManagementConfig.notifyOnSales / notifyOnReservations).
 *
 * Best-effort: never throws, so a failing alert cannot break the sale or reservation.
 * Callers schedule them with `afterCommit`, so a rolled-back request alerts nobody.
 */

/** Runs `fn` once `session` has ended with a committed transaction (immediately when there is no session). */
export function afterCommit(session: ClientSession | undefined | null, fn: () => Promise<unknown>): void {
    if (!session) {
        void fn();
        return;
    }
    session.once("ended", () => {
        if (session.transaction?.isCommitted) void fn();
    });
}

type UnitContext = {
    unitId: string;
    unitNumber?: string;
    unitDisplayName?: string;
    projectName?: string;
    edificeName?: string;
    floorName?: string;
};

type Base = UnitContext & {
    companyId: ObjectId | string;
    companyName: string;
    languageCode: string;
};

export type NotifySalesWatchersInput = Base & {
    saleId: string;
    saleCode?: string;
    pendingApproval: boolean;
    finalPriceDisplay?: string;
    unitPriceDisplay?: string;
    localDiscountDisplay?: string;
    downPaymentDisplay?: string;
    downPaymentPaid?: boolean;
    numberOfInstallments?: number;
    paymentSchedule?: PaymentScheduleRowForEmail[];
    paymentType: "cash" | "payment_plan";
    buyerId?: string;
    soldById?: string;
};

export type NotifyReservationWatchersInput = Base & {
    reservationId: string;
    reservationCode?: string;
    clientId?: string;
    depositDisplay?: string;
    expirationDateFormatted?: string;
    createdById?: string;
};

type UserLite = {_id: ObjectId; username?: string; name?: string; surname?: string; fullName?: string};

function displayName(u: UserLite | undefined): string | undefined {
    if (!u) return undefined;
    return u.fullName || `${u.name ?? ""} ${u.surname ?? ""}`.trim() || u.username || undefined;
}

function toObjectIds(ids: (string | undefined)[]): ObjectId[] {
    return ids.filter((id): id is string => !!id && ObjectId.isValid(id)).map(id => new ObjectId(id));
}

/** Active members of the company among `ids` (drops stale / foreign / deactivated users). */
async function activeCompanyUsers(companyId: ObjectId, ids: string[]): Promise<UserLite[]> {
    const oids = toObjectIds(ids);
    if (!oids.length) return [];
    return await User.find({_id: {$in: oids}, companies: companyId, isActive: true})
        .select("_id username name surname fullName")
        .lean<UserLite[]>();
}

async function namesById(ids: (string | undefined)[]): Promise<Map<string, string>> {
    const oids = toObjectIds(ids);
    const out = new Map<string, string>();
    if (!oids.length) return out;
    const users = await User.find({_id: {$in: oids}}).select("_id username name surname fullName").lean<UserLite[]>();
    for (const u of users) {
        const name = displayName(u);
        if (name) out.set(u._id.toString(), name);
    }
    return out;
}

async function emailEach(recipients: UserLite[], send: (r: UserLite) => Promise<void>, label: string): Promise<void> {
    await Promise.all(
        recipients
            .filter(r => !!r.username)
            .map(r => send(r).catch((e: unknown) => {
                console.error(`Failed to send ${label} staff alert email to ${r._id}:`, e);
            })),
    );
}

/** @returns how many watchers were alerted (0 when none are configured or on failure). */
export async function notifySalesWatchers(input: NotifySalesWatchersInput): Promise<number> {
    try {
        const companyId = typeof input.companyId === "string" ? new ObjectId(input.companyId) : input.companyId;
        const {notifyOnSales} = await propertyManagementConfigService.getNotificationRecipients(companyId);
        const recipients = await activeCompanyUsers(companyId, notifyOnSales);
        if (!recipients.length) return 0;

        const names = await namesById([input.buyerId, input.soldById]);
        const buyerName = input.buyerId ? names.get(input.buyerId) : undefined;
        const soldByName = input.soldById ? names.get(input.soldById) : undefined;

        emitNotificationEvent(NotificationEventCodes.SALE_CREATED_STAFF, {
            receiverIds: recipients.map(r => r._id.toString()),
            payload: {
                companyId: companyId.toString(),
                saleId: input.saleId,
                unitId: input.unitId,
                unitNumber: input.unitNumber,
                finalPriceDisplay: input.finalPriceDisplay,
                buyerName,
                soldByName,
                pendingApproval: input.pendingApproval,
                languageCode: input.languageCode,
            },
        });

        await emailEach(recipients, r => sendSalesStaffAlertMail({
            kind: "sale_created",
            email: r.username!,
            fullName: displayName(r) ?? r.username!,
            languageCode: input.languageCode,
            companyId: companyId.toString(),
            companyName: input.companyName,
            saleId: input.saleId,
            saleCode: input.saleCode,
            pendingApproval: input.pendingApproval,
            finalPriceDisplay: input.finalPriceDisplay,
            unitPriceDisplay: input.unitPriceDisplay,
            localDiscountDisplay: input.localDiscountDisplay,
            downPaymentDisplay: input.downPaymentDisplay,
            downPaymentPaid: input.downPaymentPaid,
            numberOfInstallments: input.numberOfInstallments,
            paymentSchedule: input.paymentSchedule,
            paymentType: input.paymentType,
            buyerName,
            soldByName,
            unitId: input.unitId,
            unitNumber: input.unitNumber,
            unitDisplayName: input.unitDisplayName,
            projectName: input.projectName,
            edificeName: input.edificeName,
            floorName: input.floorName,
        }), "sale");
        return recipients.length;
    } catch (e) {
        console.error("Failed to notify sales watchers:", e);
        return 0;
    }
}

/** @returns how many watchers were alerted (0 when none are configured or on failure). */
export async function notifyReservationWatchers(input: NotifyReservationWatchersInput): Promise<number> {
    try {
        const companyId = typeof input.companyId === "string" ? new ObjectId(input.companyId) : input.companyId;
        const {notifyOnReservations} = await propertyManagementConfigService.getNotificationRecipients(companyId);
        const recipients = await activeCompanyUsers(companyId, notifyOnReservations);
        if (!recipients.length) return 0;

        const names = await namesById([input.clientId, input.createdById]);
        const clientName = input.clientId ? names.get(input.clientId) : undefined;
        const createdByName = input.createdById ? names.get(input.createdById) : undefined;

        emitNotificationEvent(NotificationEventCodes.RESERVATION_CREATED_STAFF, {
            receiverIds: recipients.map(r => r._id.toString()),
            payload: {
                companyId: companyId.toString(),
                reservationId: input.reservationId,
                unitId: input.unitId,
                unitNumber: input.unitNumber,
                clientName,
                depositDisplay: input.depositDisplay,
                expirationDate: input.expirationDateFormatted,
                languageCode: input.languageCode,
            },
        });

        await emailEach(recipients, r => sendSalesStaffAlertMail({
            kind: "reservation_created",
            email: r.username!,
            fullName: displayName(r) ?? r.username!,
            languageCode: input.languageCode,
            companyId: companyId.toString(),
            companyName: input.companyName,
            reservationId: input.reservationId,
            reservationCode: input.reservationCode,
            clientName,
            depositDisplay: input.depositDisplay,
            expirationDateFormatted: input.expirationDateFormatted,
            createdByName,
            unitId: input.unitId,
            unitNumber: input.unitNumber,
            unitDisplayName: input.unitDisplayName,
            projectName: input.projectName,
            edificeName: input.edificeName,
            floorName: input.floorName,
        }), "reservation");
        return recipients.length;
    } catch (e) {
        console.error("Failed to notify reservation watchers:", e);
        return 0;
    }
}
