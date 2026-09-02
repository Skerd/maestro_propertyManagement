import {Decimal128, ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {ILease} from "../../database/schemas/lease/lease";
import {RentalPaymentStatus} from "../../database/schemas/rentalPayment/rentalPayment";
import {rentalPaymentService} from "../../database/schemas/rentalPayment/rentalPayment.service";
import {
    hasCollectedCash,
    moneyToScaled,
} from "./rentRemaining";
import {
    buildMonthlyRentDueDates,
    dueDateKey,
    rentScheduleExceedsCap,
    utcDateOnly,
} from "./rentalPaymentSchedule";

type Ctx = {
    session?: any;
    logger: any;
    languageCode: string;
    actionUserCtx?: {userId?: any};
    company: {_id: ObjectId};
};

function idString(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "object" && value !== null && "_id" in value) {
        return String((value as {_id: unknown})._id);
    }
    return String(value);
}

function asDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
}

function isDuplicateKeyError(err: unknown): boolean {
    return typeof err === "object" && err != null && "code" in err && (err as {code: number}).code === 11000;
}

async function createPendingRows(
    lease: ILease,
    dueDates: Date[],
    existingKeys: Set<string>,
    ctx: Ctx,
): Promise<void> {
    const {session, logger, languageCode, actionUserCtx, company} = ctx;
    const amount = lease.monthlyRent;
    if (amount == null || moneyToScaled(amount) === 0n) return;

    const currency = (lease.rentCurrency as any)?._id ?? lease.rentCurrency;
    const leaseUnit = (lease.unit as any)?._id ?? lease.unit;
    const rows = dueDates
        .filter((dueDate) => !existingKeys.has(dueDateKey(dueDate)))
        .map((dueDate) => ({
            lease: lease._id,
            unit: leaseUnit,
            dueDate,
            amount,
            currency,
            status: RentalPaymentStatus.PENDING,
            company: company._id,
        }));
    if (rows.length === 0) return;
    try {
        await rentalPaymentService.createMany(rows as any, {
            session,
            logger,
            languageCode,
            auditUserId: actionUserCtx?.userId,
        });
    } catch (err: unknown) {
        if (isDuplicateKeyError(err)) {
            throw apiValidationException("rental_payment_duplicate_due", "", null, languageCode);
        }
        throw err;
    }
}

export async function resyncLeaseSchedule(previous: ILease, current: ILease, ctx: Ctx): Promise<void> {
    const {session, logger, languageCode, actionUserCtx, company} = ctx;

    const prevUnit = idString(previous.unit);
    const nextUnit = idString(current.unit);
    if (prevUnit && nextUnit && prevUnit !== nextUnit) {
        throw apiValidationException("lease_unit_immutable", "", null, languageCode);
    }

    const payments = await rentalPaymentService.find(
        {lease: current._id, company: company._id, deletedAt: null},
        {session, logger, languageCode},
        [],
        undefined,
        {dueDate: 1},
    );

    const prevCurrency = idString(previous.rentCurrency);
    const nextCurrency = idString(current.rentCurrency);
    if (prevCurrency && nextCurrency && prevCurrency !== nextCurrency && payments.length > 0) {
        throw apiValidationException("lease_currency_change_with_payments", "", null, languageCode);
    }

    const startDate = asDate(current.startDate);
    const endDate = asDate(current.endDate);
    if (rentScheduleExceedsCap(startDate, endDate) && moneyToScaled(current.monthlyRent) > 0n) {
        throw apiValidationException("lease_term_too_long", "", null, languageCode);
    }

    const startChanged = utcDateOnly(asDate(previous.startDate)).getTime() !== utcDateOnly(startDate).getTime();
    const endChanged = utcDateOnly(asDate(previous.endDate)).getTime() !== utcDateOnly(endDate).getTime();
    const rentChanged = moneyToScaled(previous.monthlyRent) !== moneyToScaled(current.monthlyRent);

    if (startChanged) {
        if (payments.some((p) => hasCollectedCash(p) || p.status === RentalPaymentStatus.PAID || p.status === RentalPaymentStatus.PARTIALLY_PAID)) {
            throw apiValidationException("lease_start_after_collected_rent", "", null, languageCode);
        }
        await rentalPaymentService.deleteMany(
            {lease: current._id, company: company._id, deletedAt: null},
            {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
        );
        const dueDates = buildMonthlyRentDueDates(startDate, endDate);
        await createPendingRows(current, dueDates, new Set(), ctx);
        return;
    }

    if (endChanged) {
        const newEnd = utcDateOnly(endDate);
        const prevEnd = utcDateOnly(asDate(previous.endDate));
        if (newEnd.getTime() < prevEnd.getTime()) {
            for (const payment of payments) {
                if (utcDateOnly(payment.dueDate).getTime() <= newEnd.getTime()) continue;
                if (
                    hasCollectedCash(payment)
                    || payment.status === RentalPaymentStatus.PAID
                    || payment.status === RentalPaymentStatus.PARTIALLY_PAID
                ) {
                    throw apiValidationException("lease_end_before_collected_rent", "", null, languageCode);
                }
            }
            await rentalPaymentService.updateMany(
                {
                    lease: current._id,
                    company: company._id,
                    deletedAt: null,
                    dueDate: {$gt: newEnd},
                    status: {$in: [RentalPaymentStatus.PENDING, RentalPaymentStatus.OVERDUE]},
                },
                {$set: {status: RentalPaymentStatus.WAIVED}},
                {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
            );
        } else {
            const dueDates = buildMonthlyRentDueDates(startDate, endDate);
            const existingKeys = new Set(payments.map((p) => dueDateKey(p.dueDate)));
            await createPendingRows(current, dueDates, existingKeys, ctx);
        }
    }

    if (rentChanged) {
        const nextAmount = current.monthlyRent as Decimal128;
        for (const payment of payments) {
            if (hasCollectedCash(payment)) continue;
            if (payment.status !== RentalPaymentStatus.PENDING && payment.status !== RentalPaymentStatus.OVERDUE) continue;
            await rentalPaymentService.updateByIdOrThrow(
                payment._id,
                {$set: {amount: nextAmount}},
                {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
            );
        }
    }
}

export async function generateLeaseSchedule(lease: ILease, ctx: Ctx): Promise<void> {
    const startDate = asDate(lease.startDate);
    const endDate = asDate(lease.endDate);
    if (moneyToScaled(lease.monthlyRent) === 0n) return;
    if (rentScheduleExceedsCap(startDate, endDate)) {
        throw apiValidationException("lease_term_too_long", "", null, ctx.languageCode);
    }
    const dueDates = buildMonthlyRentDueDates(startDate, endDate);
    await createPendingRows(lease, dueDates, new Set(), ctx);
}
