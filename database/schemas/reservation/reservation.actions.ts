import {Decimal128, ObjectId} from "mongodb";
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
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {
    dispatchReservationClientEmail,
    formatReservationExpirationForEmail,
    type DispatchReservationClientEmailInput,
} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {
    formatMoneyAmountForEmail,
    formatReservationDepositForEmailDisplay,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import {
    isPastExpirationUtcEndOfDay,
    utcCalendarDaysUntilExpirationDay,
} from "@propertyManagement/utilities/reservation/reservationExpirationCalendar";
import {recordCommission, voidPendingCommission} from "../../../utilities/mappers/commissions/commission";
import {CommissionSourceType, CommissionStatus} from "../commission/commission";
import {commissionService} from "../commission/commission.service";
import {unitService} from "../unit/unit.service";
import Reservation, {type IReservation, ReservationStatus} from "./reservation";
import {reservationService} from "./reservation.service";
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
    "unitDisplayName" | "unitPriceDisplay" | "reservationDepositDisplay" | "depositSummary" | "reservationContractMediaId"
> {
    const unit = reservation.unit as {
        unitNumber?: string | number;
        name?: string;
        price?: Decimal128;
        priceCurrency?: {symbol?: string};
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

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        schema: manualReservationClientEmailFormSchema,
    })
    async manualClientEmail(params: Record<string, any>): Promise<{ok: true}> {
        const {logger, languageCode, _id, action, actionUserCtx, company} =
            params as Record<string, any> & ManualReservationClientEmailForm;

        logger.start(`Manual reservation client email: ${action} for ${_id}`);

        try {
            SchemaGuard.sanitizeFields(Reservation, {isActive: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
        }

        const reservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            [
                {path: "client", select: "username name surname fullName"},
                {path: "reservedByCompany", select: "name"},
                {
                    path: "unit",
                    select: "unitNumber name price",
                    populate: [{path: "priceCurrency", select: "symbol"}],
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

        const unitRef = reservation.unit as {unitNumber?: string | number} | undefined;
        const unitNumber = unitRef?.unitNumber != null ? String(unitRef.unitNumber) : undefined;

        const exp = reservation.expirationDate ? new Date(reservation.expirationDate) : undefined;
        const expIso = exp ? exp.toISOString() : undefined;
        const lang = languageCode ?? "en-US";
        const expFormatted = formatReservationExpirationForEmail(expIso, lang);

        const base: Omit<DispatchReservationClientEmailInput, "kind"> = {
            clientUserId,
            languageCode: lang,
            companyId: company._id.toString(),
            companyName,
            reservationId: reservation._id.toString(),
            reservationCode: reservation.name,
            unitNumber,
            expirationDateIso: expIso,
            expirationDateFormatted: expFormatted,
        };

        let payload: DispatchReservationClientEmailInput;

        switch (action) {
            case "send_confirmation":
                payload = {
                    ...base,
                    kind: "created",
                    ...reservationClientEmailListingFieldsFromLoadedReservation(reservation, lang),
                };
                break;
            case "remind_3d":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (utcCalendarDaysUntilExpirationDay(exp) < 3) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_reminder", reminderPhase: "3"};
                break;
            case "remind_1d":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (utcCalendarDaysUntilExpirationDay(exp) < 1) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_reminder", reminderPhase: "1"};
                break;
            case "remind_today":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (utcCalendarDaysUntilExpirationDay(exp) !== 0 || isPastExpirationUtcEndOfDay(exp)) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_reminder", reminderPhase: "0"};
                break;
            case "send_expired":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (!isPastExpirationUtcEndOfDay(exp)) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                payload = {...base, kind: "expiration_expired"};
                break;
            case "remind_remaining_days":
                if (!exp) {
                    throw apiValidationException("reservation_expiration_required", "", null, languageCode);
                }
                if (isPastExpirationUtcEndOfDay(exp)) {
                    throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                }
                {
                    const daysRemaining = utcCalendarDaysUntilExpirationDay(exp);
                    if (daysRemaining < 0) {
                        throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
                    }
                    payload = {...base, kind: "remaining_days", daysRemaining};
                }
                break;
            default:
                throw apiValidationException("manual_reservation_email_action_not_allowed", "", null, languageCode);
        }

        const sent = await dispatchReservationClientEmail(payload);
        if (!sent) {
            throw apiValidationException("client_has_no_email", "", null, languageCode);
        }

        logger.finish(`Manual reservation client email sent: ${action} for ${_id}`);
        return {ok: true};
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
        const unit = await unitService.findOneOrThrow(
            {_id: existingReservation.unit, company: company._id},
            {session, logger, languageCode},
        );

        try {
            SchemaGuard.sanitizeFields(Reservation, {isActive: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
        }

        let canAddCancellationReason = true;
        try {
            SchemaGuard.sanitizeFields(Reservation, {cancellationReason: {}}, "write", actionUserCtx, languageCode);
        } catch {
            canAddCancellationReason = false;
        }

        const updateData: Record<string, unknown> = {
            isActive: false,
            cancelledAt: new Date(),
            status: ReservationStatus.CANCELLED,
        };
        if (canAddCancellationReason) {
            updateData.cancellationReason = cancellationReason;
        }

        await reservationService.updateByIdOrThrow(
            new ObjectId(_id),
            {$set: updateData},
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

        if (unit.reservation?.toString() === existingReservation._id.toString()) {
            if (unit.status === UnitStatus.RESERVED) {
                unit.status = UnitStatus.AVAILABLE;
            }
            unit.reservation = undefined;
            unit.$locals = unit.$locals || {};
            unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
            await unit.save({session});
        }

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
                unitId: unit._id.toString(),
                unitNumber: (unit as any).unitNumber,
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

        if (!([UnitStatus.AVAILABLE, UnitStatus.SOLD] as UnitStatus[]).includes(unit.status) || unit.reservation) {
            throw apiValidationException("unit_not_available_for_reactivation", "", null, languageCode);
        }

        try {
            SchemaGuard.sanitizeFields(Reservation, {isActive: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
        }

        await reservationService.updateByIdOrThrow(
            new ObjectId(_id),
            {
                $set: {isActive: true, status: ReservationStatus.ACTIVE},
                $unset: {cancelledAt: "", cancellationReason: ""},
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

        try {
            SchemaGuard.sanitizeFields(Reservation, {isActive: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
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
            [{path: "priceCurrency", select: "symbol"}],
            "unitNumber name price",
        );
        const payExpIso = existingReservation.expirationDate
            ? new Date(existingReservation.expirationDate).toISOString()
            : undefined;
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
                unitPriceDisplay: payUnitPriceDisplay,
                reservationDepositDisplay: payDepositDisplay,
                depositSummary: payDepositDisplay,
                expirationDateIso: payExpIso,
                expirationDateFormatted: formatReservationExpirationForEmail(payExpIso, payLang),
            },
            {session},
        ).catch((err: Error) => {
            logger.debug(`Reservation paid client email skipped or failed: ${err.message}`);
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

        try {
            SchemaGuard.sanitizeFields(Reservation, {isActive: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("reservation_not_found", "", null, languageCode);
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
