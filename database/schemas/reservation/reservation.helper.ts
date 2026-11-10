/**
 * Ending a reservation. Staff cancelling it (the `cancel` action) and the expiry cron (`runReservationExpiredStamp`)
 * end it through the one `endReservation` (BE-02); each trigger adds only its own checks.
 */
import type {ClientSession} from "mongoose";
import {ObjectId} from "mongodb";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import type {UserContext} from "@coreModule/utilities/types/types";
import {voidPendingCommission} from "@propertyManagement/utilities/mappers/commissions/commission";
import type {IUnit} from "../unit/unit";
import {unitService} from "../unit/unit.service";
import {CommissionSourceType} from "../commission/commission";
import {type IReservation, ReservationStatus} from "./reservation";
import {reservationService} from "./reservation.service";

export type ReservationEnding =
    | {status: ReservationStatus.CANCELLED; cancellationReason?: string}
    | {status: ReservationStatus.EXPIRED};

export type ReservationTransitionContext = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    companyId: ObjectId;
    /** Absent when a system job (the expiry cron) ends the reservation. */
    actionUserCtx?: UserContext;
};

/**
 * Ends an active reservation: it is stamped cancelled or expired, its unpaid commission is voided, and its unit, while
 * still held by it, is freed. A cancelled reservation is no longer active (`isActive: false`); an expired one keeps
 * `isActive`, as the expiry stamp always did (the reservation screens read the status). Returns the unit, or null when
 * it no longer exists.
 */
export async function endReservation(
    reservation: IReservation,
    ending: ReservationEnding,
    ctx: ReservationTransitionContext,
): Promise<IUnit | null> {
    const {session, logger, languageCode, companyId, actionUserCtx} = ctx;
    const now = new Date();
    const $set = ending.status === ReservationStatus.CANCELLED
        ? {isActive: false, status: ending.status, cancelledAt: now, cancellationReason: ending.cancellationReason}
        : {status: ending.status, expiredAt: now};

    await reservationService.updateByIdOrThrow(
        reservation._id,
        {$set},
        {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
    );

    await voidPendingCommission({
        sourceId: reservation._id,
        sourceType: CommissionSourceType.RESERVATION,
        companyId,
        session,
        actionUserCtx,
        logger,
    });

    const unit = await unitService.findOne(
        {_id: nestedEntityToRef(reservation.unit), company: companyId},
        {session, logger, languageCode},
    );
    if (unit && nestedEntityToRef(unit.reservation)?.equals(reservation._id)) {
        if (unit.status === UnitStatus.RESERVED) {
            unit.status = UnitStatus.AVAILABLE;
        }
        unit.reservation = undefined;
        if (actionUserCtx) {
            unit.$locals = unit.$locals || {};
            unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        }
        await unit.save({session});
    }
    return unit;
}
