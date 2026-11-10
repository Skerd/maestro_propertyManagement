/**
 * Undoing a sale and putting it back. Rejecting a sale (`approveSale`) and deleting it (the sale router's
 * `afterDelete`) release what selling the unit did through the one `releaseSale` (BE-02); restoring a deleted sale
 * takes it back with `retakeSale`.
 */
import type {ClientSession} from "mongoose";
import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import type {UserContext} from "@coreModule/utilities/types/types";
import {recordCommission, voidPendingCommission} from "@propertyManagement/utilities/mappers/commissions/commission";
import type {ISale} from "./sale";
import {unitService} from "../unit/unit.service";
import {paymentPlanService} from "../paymentPlan/paymentPlan.service";
import {InstallmentStatus, PaymentPlanStatus} from "../paymentPlan/paymentPlan";
import {reservationService} from "../reservation/reservation.service";
import {ReservationStatus} from "../reservation/reservation";
import {CommissionSourceType} from "../commission/commission";

export type SaleTransitionContext = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    actionUserCtx: UserContext;
    companyId: ObjectId;
};

/**
 * Releases what the sale did: its payment plan is cancelled (no more reminders or payments), its unpaid commission
 * voided, and, while the unit is still this sale's, the reservation it converted stands again (ACTIVE: the client's
 * paid deposit still holds the unit) and the unit goes back to reserved by it, or to available. Each step only acts on
 * what this sale left, so releasing twice (a rejected sale deleted later) changes nothing.
 */
export async function releaseSale(sale: ISale, ctx: SaleTransitionContext): Promise<void> {
    const {session, logger, languageCode, actionUserCtx, companyId} = ctx;
    const opts = {session, logger, languageCode, auditUserId: actionUserCtx.userId};

    const planId = nestedEntityToRef(sale.paymentPlan);
    if (planId) {
        await paymentPlanService.updateOne(
            {_id: planId, company: companyId, status: {$ne: PaymentPlanStatus.CANCELLED}},
            {$set: {status: PaymentPlanStatus.CANCELLED}},
            opts,
        );
    }

    await voidPendingCommission({
        sourceId: sale._id,
        sourceType: CommissionSourceType.SALE,
        companyId,
        session,
        actionUserCtx,
        logger,
    });

    // A unit sold again since (a rejected sale deleted later) is the newer sale's, and so is its reservation.
    const unit = await unitService.findOneOrThrow({_id: nestedEntityToRef(sale.unit), company: companyId}, {session, logger, languageCode});
    if (!nestedEntityToRef(unit.sale)?.equals(sale._id)) return;

    const reservationId = nestedEntityToRef(sale.reservation);
    const reservationBack = reservationId !== undefined && (await reservationService.updateOne(
        {_id: reservationId, company: companyId, status: ReservationStatus.CONVERTED},
        {$set: {status: ReservationStatus.ACTIVE}},
        opts,
    )).modifiedCount > 0;

    unit.sale = undefined;
    // Selling left `unit.reservation` on the converted reservation, so a reservation back in force holds it again.
    if (reservationBack) {
        unit.status = UnitStatus.RESERVED;
    } else {
        unit.status = UnitStatus.AVAILABLE;
        unit.reservation = undefined;
    }
    unit.$locals = unit.$locals || {};
    unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
    await unit.save({session});
}

/**
 * Takes a released sale back when it is restored: the unit is sold again, the reservation converted again, the payment
 * plan open again and the commission owed again. Refused when the unit was sold, or reserved by another reservation,
 * in the meantime.
 */
export async function retakeSale(sale: ISale, ctx: SaleTransitionContext): Promise<void> {
    const {session, logger, languageCode, actionUserCtx, companyId} = ctx;
    const opts = {session, logger, languageCode, auditUserId: actionUserCtx.userId};

    const unit = await unitService.findOneOrThrow({_id: nestedEntityToRef(sale.unit), company: companyId}, {session, logger, languageCode});
    const reservationId = nestedEntityToRef(sale.reservation);
    const unitReservation = nestedEntityToRef(unit.reservation);
    if (unit.status === UnitStatus.SOLD || unit.sale || (unitReservation && !unitReservation.equals(reservationId))) {
        throw apiValidationException("sale_not_available_for_restore", "", null, languageCode);
    }

    unit.status = UnitStatus.SOLD;
    unit.sale = sale;
    unit.$locals = unit.$locals || {};
    unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
    await unit.save({session});

    if (reservationId) {
        await reservationService.updateOne(
            {_id: reservationId, company: companyId, status: ReservationStatus.ACTIVE},
            {$set: {status: ReservationStatus.CONVERTED}},
            opts,
        );
    }

    const planId = nestedEntityToRef(sale.paymentPlan);
    if (planId) {
        const plan = await paymentPlanService.findOneOrThrow({_id: planId, company: companyId}, {session, logger, languageCode, withDeleted: true});
        if (plan.deletedAt) await paymentPlanService.restoreOneOrThrow({_id: planId, company: companyId}, opts);
        if (plan.status === PaymentPlanStatus.CANCELLED) {
            const settled = plan.downPaymentPaid && plan.installments.every((inst) => inst.status === InstallmentStatus.PAID);
            await paymentPlanService.updateByIdOrThrow(
                planId,
                {$set: {status: settled ? PaymentPlanStatus.COMPLETED : PaymentPlanStatus.ACTIVE}},
                opts,
            );
        }
    }

    await recordCommission({
        sourceId: sale._id,
        sourceType: CommissionSourceType.SALE,
        companyId,
        session,
        actionUserCtx,
        logger,
        languageCode,
    });
}
