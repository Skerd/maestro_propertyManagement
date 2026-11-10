import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {Decimal128, ObjectId} from "mongodb";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {cancelReservationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/cancelReservation.form.validator";
import type {CancelReservationForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/cancelReservation.form.type";
import {manualReservationClientEmailFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/manualReservationClientEmail.form.validator";
import type {ManualReservationClientEmailForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/manualReservationClientEmail.form.type";
import type {Reservation as ReservationData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.dto";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {notifyReservationWatchers} from "@propertyManagement/utilities/sale/salesStaffNotify";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {
    dispatchReservationClientEmail,
    formatReservationExpirationForEmail,
    type DispatchReservationClientEmailInput,
} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {
    formatMoneyAmountForEmail,
    formatReservationDepositForEmailDisplay,
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import {calendarDaysUntil, isCalendarDayOver} from "@propertyManagement/utilities/reservation/reservationExpirationCalendar";
import {companyTodayOf} from "@coreModule/utilities/time/companyTimeZone";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {recordCommission, voidPendingCommission} from "../commission/commission.helper";
import {CommissionSourceType, CommissionStatus} from "../commission/commission";
import {commissionService} from "../commission/commission.service";
import {unitService} from "../unit/unit.service";
import Reservation, {type IReservation, ReservationStatus} from "./reservation";
import {reservationService} from "./reservation.service";
import {endReservation} from "./reservation.helper";
import {reservationToDTO} from "@propertyManagement/utilities/mappers/reservation/reservationMapper.dto";

function reservationContractMediaIdFromReservation(reservation: IReservation): string | undefined {
    const contracts = reservation.reservationContract as (ObjectId | {_id?: ObjectId})[] | undefined | null;
    if (!contracts?.length) return undefined;
    const c = contracts[0];
    if (c instanceof ObjectId) return c.toString();
    if (typeof c === "object" && c._id) return c._id.toString();
    return undefined;
}

function reservationClientEmailListingFieldsFromLoadedReservation(
    reservation: IReservation,
    languageCode: string,
): Pick<
    DispatchReservationClientEmailInput,
    "unitDisplayName" | "unitPriceDisplay" | "reservationDepositDisplay" | "depositSummary" | "reservationContractMediaId" | "projectName" | "edificeName" | "floorName"
> {
    const unit = reservation.unit as {
        unitNumber?: string | number;
        name?: string;
        price?: Decimal128;
        priceCurrency?: {symbol?: string};
        floor?: {name?: string; levelNumber?: number};
        edifice?: {name?: string};
        project?: {name?: string};
    };
    const unitDisplayName = unit?.name;
    let unitPriceDisplay: string | undefined;
    if (unit?.price != null) {
        const sym = unit.priceCurrency?.symbol;
        const amt = formatMoneyAmountForEmail(unit.price.toString(), languageCode);
        unitPriceDisplay = sym ? `${amt} ${sym}` : amt;
    }
    const depositDisp = formatReservationDepositForEmailDisplay(
        reservation.depositAmount,
        (reservation.depositCurrency as {symbol?: string} | undefined)?.symbol,
        languageCode,
    );
    return {
        unitDisplayName,
        unitPriceDisplay,
        reservationDepositDisplay: depositDisp,
        depositSummary: depositDisp,
        reservationContractMediaId: reservationContractMediaIdFromReservation(reservation),
        ...unitLocationForEmail(unit),
    };
}

async function loadReservationDto(
    reservationId: ObjectId,
    params: {session?: unknown; logger: unknown; languageCode: string; actionUserCtx: unknown},
): Promise<ReservationData | undefined> {
    const {session, logger, languageCode, actionUserCtx} = params;
    try {
        const readSanitizedFields = SchemaGuard.sanitizeFields(
            Reservation,
            getModelCollectedData("reservations").readFields!,
            "read",
            actionUserCtx as any,
            languageCode,
        );
        const populate = SchemaGuard.generatePopulate(readSanitizedFields, Reservation.schema);
        const updated = await reservationService.findById(
            reservationId,
            {session, logger, languageCode} as any,
            populate.populate,
        );
        return reservationToDTO(updated);
    } catch {
        (logger as {debug: (m: string) => void}).debug("User has no read permission on reservation!");
        return undefined;
    }
}

export class ReservationActions {

    /** Re-sends the "new reservation" alert to the Sales & handover → Notify on reservations list. */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        schema: validateSingleForm,
    })
    async resendStaffNotifications(params: Record<string, any>): Promise<{ok: true; recipients: number}> {
        const {logger, languageCode, _id, actionUserCtx, company} = params;

        logger.start(`Resending staff notifications for reservation: ${_id}`);

        const reservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            [
                {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
                {path: "depositCurrency", select: "symbol"},
            ],
        );
        if (reservation.deletedAt) {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
        }

        const lang = languageCode ?? "en-US";
        const unitRef = reservation.unit as {_id?: ObjectId; unitNumber?: string | number} | undefined;
        const idOf = (ref: unknown) =>
            ref instanceof ObjectId ? ref.toString() : (ref as {_id?: ObjectId} | undefined)?._id?.toString();
        const listing = reservationClientEmailListingFieldsFromLoadedReservation(reservation, lang);
        const expIso: string | undefined = reservation.expirationDate || undefined;

        const recipients = await notifyReservationWatchers({
            companyId: company._id,
            companyName: company.name ?? "",
            languageCode: lang,
            reservationId: reservation._id.toString(),
            reservationCode: reservation.name,
            clientId: idOf(reservation.client),
            depositDisplay: listing.reservationDepositDisplay,
            expirationDateFormatted: formatReservationExpirationForEmail(expIso, lang),
            createdById: idOf((reservation as {createdBy?: unknown}).createdBy),
            unitId: idOf(reservation.unit) ?? "",
            unitNumber: unitRef?.unitNumber != null ? String(unitRef.unitNumber) : undefined,
            unitDisplayName: listing.unitDisplayName,
            projectName: listing.projectName,
            edificeName: listing.edificeName,
            floorName: listing.floorName,
        });
        if (!recipients) {
            throw apiValidationException("no_notification_recipients", "", null, languageCode);
        }

        logger.finish(`Resent reservation staff notifications to ${recipients} user(s)`);
        return {ok: true, recipients};
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        schema: manualReservationClientEmailFormSchema,
    })
    async manualClientEmail(params: Record<string, any>): Promise<ReservationData | undefined> {
        const {logger, languageCode, _id, action, actionUserCtx, company} =
            params as Record<string, any> & ManualReservationClientEmailForm;

        logger.start(`Manual reservation client email: ${action} for ${_id}`);

        const reservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            [
                {path: "client", select: "username name surname fullName"},
                {path: "reservedByCompany", select: "name"},
                {
                    path: "unit",
                    select: UNIT_EMAIL_SELECT,
                    populate: UNIT_EMAIL_POPULATE,
                },
                {path: "depositCurrency", select: "symbol"},
                {path: "reservationContract", select: "_id"},
            ],
        );

        if (reservation.deletedAt) {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
        }
        if (!reservation.isActive) {
            throw apiValidationException("manual_reservation_email_inactive", "", null, languageCode);
        }
        if (reservation.paid) {
            throw apiValidationException("manual_reservation_email_paid", "", null, languageCode);
        }

        const rawClient = reservation.client as {_id?: ObjectId} | ObjectId | null | undefined;
        const clientUserId =
            rawClient instanceof ObjectId
                ? rawClient
                : rawClient && typeof rawClient === "object" && rawClient._id
                  ? rawClient._id
                  : undefined;
        if (!clientUserId) {
            throw apiValidationException("reservation_client_missing", "", null, languageCode);
        }

        const companyRef = reservation.reservedByCompany as {name?: string} | undefined;
        const companyName = companyRef?.name ?? "";

        const unitRef = reservation.unit as {unitNumber?: string | number; name?: string; _id?: ObjectId} | undefined;
        const unitNumber = unitRef?.unitNumber != null ? String(unitRef.unitNumber) : undefined;

        const today = await companyTodayOf(company._id);
        const exp: string | undefined = reservation.expirationDate || undefined;
        const expIso = exp;
        const lang = languageCode ?? "en-US";
        const expFormatted = formatReservationExpirationForEmail(expIso, lang);
        const listing = reservationClientEmailListingFieldsFromLoadedReservation(reservation, lang);

        const base: Omit<DispatchReservationClientEmailInput, "kind"> = {
            clientUserId,
            languageCode: lang,
            companyId: company._id.toString(),
            companyName,
            reservationId: reservation._id.toString(),
            reservationCode: reservation.name,
            unitNumber,
            unitDisplayName: listing.unitDisplayName,
            projectName: listing.projectName,
            edificeName: listing.edificeName,
            floorName: listing.floorName,
            expirationDateIso: expIso,
            expirationDateFormatted: expFormatted,
        };

        let payload: DispatchReservationClientEmailInput;
        let stampField:
            | "confirmationEmailSentAt"
            | "expirationReminderEmailAt3d"
            | "expirationReminderEmailAt1d"
            | "expirationReminderEmailAt0d"
            | undefined;

        switch (action) {
            case "send_confirmation":
                // Only a reservation that still holds the unit is confirmed: not an expired or converted one (TD-B149).
                if (reservation.status !== ReservationStatus.ACTIVE || (exp && isCalendarDayOver(exp, today))) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {
                    ...base,
                    kind: "created",
                    ...reservationClientEmailListingFieldsFromLoadedReservation(reservation, lang),
                };
                stampField = "confirmationEmailSentAt";
                break;
            case "remind_3d":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (calendarDaysUntil(exp, today) < 3) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_reminder", reminderPhase: "3"};
                stampField = "expirationReminderEmailAt3d";
                break;
            case "remind_1d":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (calendarDaysUntil(exp, today) < 1) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_reminder", reminderPhase: "1"};
                stampField = "expirationReminderEmailAt1d";
                break;
            case "remind_today":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (calendarDaysUntil(exp, today) !== 0) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_reminder", reminderPhase: "0"};
                stampField = "expirationReminderEmailAt0d";
                break;
            case "send_expired":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (!isCalendarDayOver(exp, today)) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_expired"};
                break;
            case "remind_remaining_days":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                {
                    const daysRemaining = calendarDaysUntil(exp, today);
                    if (daysRemaining < 0) {
                        throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                    }
                    payload = {...base, kind: "remaining_days", daysRemaining};
                }
                break;
            default:
                throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
        }

        // Its last day is over: end it the way the expiry cron does (TD-B140), unless the cron already has. The
        // email goes after, so a client without an email still leaves the reservation correctly expired.
        if (action === "send_expired" && reservation.status === ReservationStatus.ACTIVE) {
            await runInTransaction(logger, async (session) => {
                const active = await reservationService.findOne(
                    {_id: reservation._id, company: company._id, isActive: true, paid: false, status: ReservationStatus.ACTIVE},
                    {session, logger, languageCode},
                );
                if (active) {
                    await endReservation(active, {status: ReservationStatus.EXPIRED}, {session, logger, languageCode, companyId: company._id, actionUserCtx});
                }
            });
        }

        const sent = await dispatchReservationClientEmail(payload);
        if (!sent) {
            throw apiValidationException("client_has_no_email", "", null, languageCode);
        }

        if (stampField) {
            await reservationService.updateByIdOrThrow(
                reservation._id,
                {$set: {[stampField]: new Date()}},
                {logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }

        const returnReservation = await loadReservationDto(reservation._id, {
            logger,
            languageCode,
            actionUserCtx,
        });

        logger.finish(`Manual reservation client email sent: ${action} for ${_id}`);
        return returnReservation;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: cancelReservationFormSchema,
    })
    async cancel(params: Record<string, any>): Promise<ReservationData | undefined> {
        const {logger, languageCode, session, _id, cancellationReason, actionUserCtx, company} =
            params as Record<string, any> & CancelReservationForm;

        logger.start(`Canceling reservation: ${_id}...`);

        const existingReservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        // Expired and cancelled ones are over already; a converted one is the sale's (reject or delete the sale).
        if (existingReservation.status !== ReservationStatus.ACTIVE) {
            throw apiValidationException("reservation_not_active", "", null, languageCode);
        }

        // The cancel permission (D14) covers what cancelling writes, the reason included.
        const unit = await endReservation(
            existingReservation,
            {status: ReservationStatus.CANCELLED, cancellationReason},
            {session, logger, languageCode, companyId: company._id, actionUserCtx},
        );

        const returnReservation = await loadReservationDto(existingReservation._id, {
            session,
            logger,
            languageCode,
            actionUserCtx,
        });

        emitNotificationEvent(NotificationEventCodes.RESERVATION_CANCELLED, {
            receiverIds: [existingReservation.client?.toString()].filter(Boolean) as string[],
            payload: {
                companyId: company._id.toString(),
                reservationId: existingReservation._id.toString(),
                unitId: nestedEntityToRef(existingReservation.unit)?.toString(),
                unitNumber: unit?.unitNumber,
                cancellationReason,
                languageCode: languageCode ?? "en-US",
            },
        });

        logger.finish(`Successfully cancelled reservation: ${_id}`);
        return returnReservation;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async reinstate(params: Record<string, any>): Promise<ReservationData | undefined> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params;

        logger.start(`Reinstating reservation: ${_id}...`);

        const existingReservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (existingReservation.isActive) {
            throw apiValidationException("reservation_already_active", "", null, languageCode);
        }

        const unit = await unitService.findOneOrThrow(
            {_id: existingReservation.unit, company: company._id},
            {session, logger, languageCode},
        );

        if (unit.status !== UnitStatus.AVAILABLE || unit.reservation) {
            throw apiValidationException("unit_not_available_for_reactivation", "", null, languageCode);
        }

        await reservationService.updateByIdOrThrow(
            new ObjectId(_id),
            {
                $set: {isActive: true, status: ReservationStatus.ACTIVE},
                $unset: {cancelledAt: "", cancellationReason: "", expiredAt: ""},
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        await recordCommission({
            sourceId: existingReservation._id,
            sourceType: CommissionSourceType.RESERVATION,
            companyId: company._id,
            session,
            actionUserCtx,
            logger,
            languageCode,
        });

        unit.status = UnitStatus.RESERVED;
        unit.reservation = existingReservation._id;
        unit.$locals = unit.$locals || {};
        unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await unit.save({session});

        const returnReservation = await loadReservationDto(existingReservation._id, {
            session,
            logger,
            languageCode,
            actionUserCtx,
        });

        emitNotificationEvent(NotificationEventCodes.RESERVATION_REINSTATED, {
            receiverIds: [existingReservation.client?.toString()].filter(Boolean) as string[],
            payload: {
                companyId: company._id.toString(),
                reservationId: existingReservation._id.toString(),
                unitId: unit._id.toString(),
                unitNumber: (unit as any).unitNumber,
                languageCode: languageCode ?? "en-US",
            },
        });

        logger.finish(`Successfully reinstated reservation: ${_id}`);
        return returnReservation;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async pay(params: Record<string, any>): Promise<ReservationData | undefined> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params;

        logger.start(`Paying reservation in full: ${_id}...`);

        const existingReservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id, isActive: true},
            {session, logger, languageCode},
            [{path: "depositCurrency", select: "symbol name"}],
        );
        // An expired one keeps `isActive` (TD-B141): only an active reservation takes a payment.
        if (existingReservation.status !== ReservationStatus.ACTIVE) {
            throw apiValidationException("reservation_not_active", "", null, languageCode);
        }

        await reservationService.updateByIdOrThrow(
            new ObjectId(_id),
            {$set: {paid: true}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        await recordCommission({
            sourceId: existingReservation._id,
            sourceType: CommissionSourceType.RESERVATION,
            companyId: company._id,
            session,
            actionUserCtx,
            logger,
            languageCode,
        });

        const returnReservation = await loadReservationDto(existingReservation._id, {
            session,
            logger,
            languageCode,
            actionUserCtx,
        });

        emitNotificationEvent(NotificationEventCodes.RESERVATION_PAID, {
            receiverIds: [existingReservation.client?.toString()].filter(Boolean) as string[],
            payload: {
                companyId: company._id.toString(),
                reservationId: existingReservation._id.toString(),
                unitId: existingReservation.unit?.toString() ?? "",
                depositAmount: existingReservation.depositAmount?.toString(),
                depositCurrencyId:
                    (existingReservation.depositCurrency as any)?._id?.toString() ??
                    existingReservation.depositCurrency?.toString(),
                depositCurrencySymbol: (existingReservation.depositCurrency as any)?.symbol,
                languageCode: languageCode ?? "en-US",
            },
        });

        const payUnitId = (existingReservation.unit as any)?._id ?? existingReservation.unit;
        const payClientId = (existingReservation.client as any)?._id ?? existingReservation.client;
        const payUnit = await unitService.findById(
            payUnitId,
            {session, logger, languageCode},
            UNIT_EMAIL_POPULATE,
            UNIT_EMAIL_SELECT,
        );
        const payExpIso: string | undefined = existingReservation.expirationDate || undefined;
        const paySym = (existingReservation.depositCurrency as {symbol?: string} | undefined)?.symbol;
        const payLang = languageCode ?? "en-US";
        let payUnitPriceDisplay: string | undefined;
        if (payUnit?.price != null) {
            const psym = (payUnit.priceCurrency as {symbol?: string} | undefined)?.symbol ?? "";
            const amt = formatMoneyAmountForEmail(payUnit.price.toString(), payLang);
            payUnitPriceDisplay = psym ? `${amt} ${psym}` : amt;
        }
        const payDepositDisplay = formatReservationDepositForEmailDisplay(
            existingReservation.depositAmount,
            paySym,
            payLang,
        );
        // Sent once the payment is saved (D06), without holding up the response.
        await runAfterCommit(session, async () => {
            void dispatchReservationClientEmail(
                {
                    clientUserId: payClientId,
                    kind: "paid",
                    languageCode: payLang,
                    companyId: company._id.toString(),
                    companyName: company.name ?? "",
                    reservationId: existingReservation._id.toString(),
                    reservationCode: existingReservation.name,
                    unitNumber: payUnit?.unitNumber != null ? String(payUnit.unitNumber) : undefined,
                    unitDisplayName: payUnit?.name,
                    ...unitLocationForEmail(payUnit),
                    unitPriceDisplay: payUnitPriceDisplay,
                    reservationDepositDisplay: payDepositDisplay,
                    depositSummary: payDepositDisplay,
                    expirationDateIso: payExpIso,
                    expirationDateFormatted: formatReservationExpirationForEmail(payExpIso, payLang),
                },
            ).catch((err: Error) => {
                logger.debug(`Reservation paid client email skipped or failed: ${err.message}`);
            });
        });

        logger.finish(`Successfully payed reservation in full: ${_id}`);
        return returnReservation;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async reversePayment(params: Record<string, any>): Promise<ReservationData | undefined> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params;

        logger.start(`Reversing reservation payment: ${_id}...`);

        const existingReservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id, isActive: true},
            {session, logger, languageCode},
        );
        if (existingReservation.status !== ReservationStatus.ACTIVE) {
            throw apiValidationException("reservation_not_active", "", null, languageCode);
        }

        const unit = await unitService.findOneOrThrow(
            {_id: existingReservation.unit, company: company._id},
            {session, logger, languageCode},
        );
        if (unit.status === UnitStatus.SOLD) {
            throw apiValidationException(
                "unit_already_sold_thus_reservation_payment_cannot_be_reversed",
                "",
                null,
                languageCode,
            );
        }

        const commission = await commissionService.findOne({
            company: company._id,
            sourceType: CommissionSourceType.RESERVATION,
            sourceId: existingReservation._id,
            status: CommissionStatus.PAID,
        });
        if (commission) {
            throw apiValidationException(
                "reservation_payment_cannot_be_reversed_since_it_already_has_a_paid_commission",
                "",
                null,
                languageCode,
            );
        }

        await reservationService.updateByIdOrThrow(
            new ObjectId(_id),
            {$set: {paid: false}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        await voidPendingCommission({
            sourceId: existingReservation._id,
            sourceType: CommissionSourceType.RESERVATION,
            companyId: company._id,
            session,
            actionUserCtx,
            logger,
        });

        const returnReservation = await loadReservationDto(existingReservation._id, {
            session,
            logger,
            languageCode,
            actionUserCtx,
        });

        emitNotificationEvent(NotificationEventCodes.RESERVATION_PAYMENT_REVERSED, {
            receiverIds: [existingReservation.client?.toString()].filter(Boolean) as string[],
            payload: {
                companyId: company._id.toString(),
                reservationId: existingReservation._id.toString(),
                unitId: unit._id.toString(),
                unitNumber: (unit as any).unitNumber,
                languageCode: languageCode ?? "en-US",
            },
        });

        logger.finish(`Successfully reversed reservation payment: ${_id}`);
        return returnReservation;
    }
}
