import {ObjectId} from "mongodb";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {propertyManagementConfigService} from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {sendSalesStaffAlertMail} from "@propertyManagement/utilities/emails/staffAlertNotifiers";
import type {PaymentScheduleRowForEmail} from "@propertyManagement/utilities/emails/salePlanSummaryForEmail";
import {getLogger} from "@coreModule/loggers/serverLog";
import {userService} from "@coreModule/database/schemas/user/user.service";
import {companyService} from "@coreModule/database/schemas/company/company.service";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {formatReservationExpirationForEmail} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {
    formatReservationDepositForEmailDisplay,
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";

const logger = getLogger("sales_staff_notify");

/**
 * Staff alerts for new sales / reservations, addressed to the users configured under
 * Sales & handover → Notifications (PropertyManagementConfig.notifyOnSales / notifyOnReservations).
 * An expired reservation also alerts the agent who made it (D112).
 *
 * Best-effort: never throws, so a failing alert cannot break the sale or reservation.
 * Callers schedule them with core `runAfterCommit`, so a rolled-back request alerts nobody.
 */

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

/**
 * Active members of the company among `ids` (drops stale / foreign / deactivated users). Membership is the user's
 * role entry for the company (`roles.active`); a user has no top-level active flag.
 */
async function activeCompanyUsers(companyId: ObjectId, ids: string[]): Promise<UserLite[]> {
    const oids = toObjectIds(ids);
    if (!oids.length) return [];
    return await userService.find(
        {_id: {$in: oids}, companies: companyId, roles: {$elemMatch: {company: companyId, active: "active"}}},
        {},
        undefined,
        "_id username name surname fullName",
    );
}

async function namesById(ids: (string | undefined)[]): Promise<Map<string, string>> {
    const oids = toObjectIds(ids);
    const out = new Map<string, string>();
    if (!oids.length) return out;
    const users = await userService.find({_id: {$in: oids}}, {}, undefined, "_id username name surname fullName");
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
                logger.err(`Failed to send ${label} staff alert email to ${r._id}:`, e);
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
        logger.err("Failed to notify sales watchers:", e);
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
        logger.err("Failed to notify reservation watchers:", e);
        return 0;
    }
}

export type NotifyReservationExpiredInput = {
    companyId: ObjectId;
    reservationId: ObjectId;
    languageCode: string;
};

/**
 * A reservation expired (D112): its agent (`reservedBy`) and the reservation watchers get the staff notice, in-app
 * and by email. The client is not emailed here: staff send that one (`manualClientEmail` `send_expired`).
 *
 * @returns how many users were alerted (0 when nobody is to be told or on failure).
 */
export async function notifyReservationExpired(input: NotifyReservationExpiredInput): Promise<number> {
    try {
        const {companyId, reservationId, languageCode} = input;
        const reservation = await reservationService.findOne(
            {_id: reservationId, company: companyId},
            {languageCode},
            [
                {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
                {path: "depositCurrency", select: "symbol"},
            ],
        );
        if (!reservation) return 0;

        const agentId = nestedEntityToRef(reservation.reservedBy)?.toString();
        const clientId = nestedEntityToRef(reservation.client)?.toString();
        const {notifyOnReservations} = await propertyManagementConfigService.getNotificationRecipients(companyId);
        const recipients = await activeCompanyUsers(companyId, agentId ? [...notifyOnReservations, agentId] : notifyOnReservations);
        if (!recipients.length) return 0;

        const names = await namesById([clientId, agentId]);
        const clientName = clientId ? names.get(clientId) : undefined;
        const agentName = agentId ? names.get(agentId) : undefined;
        const company = await companyService.findById(companyId, {}, undefined, "name");
        const unit = reservation.unit as {_id?: ObjectId; unitNumber?: string | number; name?: string} | undefined;
        const unitNumber = unit?.unitNumber != null ? String(unit.unitNumber) : undefined;
        const expirationDateFormatted = formatReservationExpirationForEmail(reservation.expirationDate?.toISOString(), languageCode);
        const depositDisplay = formatReservationDepositForEmailDisplay(
            reservation.depositAmount,
            (reservation.depositCurrency as {symbol?: string} | undefined)?.symbol,
            languageCode,
        );

        emitNotificationEvent(NotificationEventCodes.RESERVATION_EXPIRED, {
            receiverIds: recipients.map(r => r._id.toString()),
            payload: {
                companyId: companyId.toString(),
                reservationId: reservationId.toString(),
                unitId: unit?._id?.toString(),
                unitNumber,
                clientName,
                agentName,
                expirationDate: expirationDateFormatted,
                languageCode,
            },
        });

        await emailEach(recipients, r => sendSalesStaffAlertMail({
            kind: "reservation_expired",
            email: r.username!,
            fullName: displayName(r) ?? r.username!,
            languageCode,
            companyId: companyId.toString(),
            companyName: company?.name ?? "",
            reservationId: reservationId.toString(),
            reservationCode: reservation.name,
            clientName,
            depositDisplay,
            expirationDateFormatted,
            agentName,
            unitId: unit?._id?.toString(),
            unitNumber,
            unitDisplayName: unit?.name,
            ...unitLocationForEmail(reservation.unit),
        }), "reservation expired");
        return recipients.length;
    } catch (e) {
        logger.err("Failed to notify about an expired reservation:", e);
        return 0;
    }
}
