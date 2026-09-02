/**
 * Daily rental maintenance:
 *  - mark pending/partially_paid past due (+ lease grace, UTC EOD) as overdue when remaining > 0
 *  - stamp lateFeeAmount once from lease.lateFeePercentage
 *  - expire active leases past endDate, waive open payments, release units
 */

import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ObjectId} from "mongodb";
import {leaseService} from "../../database/schemas/lease/lease.service";
import {LeaseStatus} from "../../database/schemas/lease/lease";
import {rentalPaymentService} from "../../database/schemas/rentalPayment/rentalPayment.service";
import {RentalPaymentStatus} from "../../database/schemas/rentalPayment/rentalPayment";
import {
    isSettledRemaining,
    lateFeeFromPercentage,
    OPEN_RENT_STATUSES,
    remainingScaled,
} from "../lease/rentRemaining";
import {
    releaseUnitIfRented,
    unitIdFromLease,
    waiveOpenRentalPayments,
} from "../lease/leaseLifecycle";

const BATCH_SIZE = 200;
const lang = () => CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

function utcGraceEnd(dueDate: Date, gracePeriodDays: number): Date {
    return new Date(Date.UTC(
        dueDate.getUTCFullYear(),
        dueDate.getUTCMonth(),
        dueDate.getUTCDate() + gracePeriodDays,
        23, 59, 59, 999,
    ));
}

export async function runRentalMaintenance(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("rentalMaintenanceJob", parentLogger);
    logger.start("Running rental maintenance...");
    const languageCode = lang();
    const now = Date.now();

    try {
        let lastId: ObjectId | undefined;
        let overdueCount = 0;
        while (true) {
            const filter: Record<string, unknown> = {
                status: {$in: [...OPEN_RENT_STATUSES]},
                deletedAt: null,
            };
            if (lastId) filter._id = {$gt: lastId};
            const payments = await rentalPaymentService.find(
                filter,
                {logger, languageCode, timeOperations: false},
                [{path: "lease", select: "status lateFeePercentage gracePeriodDays company"}],
                undefined,
                {_id: 1},
                BATCH_SIZE,
            );
            if (payments.length === 0) break;
            lastId = payments[payments.length - 1]._id as ObjectId;

            for (const payment of payments) {
                if (payment.status === RentalPaymentStatus.PAID || payment.status === RentalPaymentStatus.WAIVED) continue;
                if (isSettledRemaining(remainingScaled(payment))) continue;

                const lease = payment.lease as unknown as {
                    status?: string;
                    lateFeePercentage?: number;
                    gracePeriodDays?: number;
                    company?: {_id?: ObjectId} | ObjectId;
                    _id?: ObjectId;
                };
                const graceDays = typeof lease?.gracePeriodDays === "number" ? lease.gracePeriodDays : 0;
                const dueDate = new Date(payment.dueDate);
                if (Number.isNaN(dueDate.getTime())) continue;
                if (now <= utcGraceEnd(dueDate, graceDays).getTime()) continue;

                const $set: Record<string, unknown> = {status: RentalPaymentStatus.OVERDUE};
                const pct = typeof lease?.lateFeePercentage === "number" ? lease.lateFeePercentage : 0;
                if (pct > 0 && payment.lateFeeAmount == null) {
                    $set.lateFeeAmount = lateFeeFromPercentage(payment.amount, pct);
                }

                await rentalPaymentService.updateByIdOrThrow(
                    payment._id,
                    {$set},
                    {logger, languageCode, timeOperations: false},
                );
                overdueCount += 1;
            }

            if (payments.length < BATCH_SIZE) break;
        }
        logger.debug(`Marked ${overdueCount} rental payments overdue`);

        let expiredCount = 0;
        let expireLast: ObjectId | undefined;
        const todayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
        while (true) {
            const filter: Record<string, unknown> = {
                status: LeaseStatus.ACTIVE,
                endDate: {$lt: todayStart},
                deletedAt: null,
            };
            if (expireLast) filter._id = {$gt: expireLast};
            const leases = await leaseService.find(
                filter,
                {logger, languageCode, timeOperations: false},
                [],
                "_id unit company",
                {_id: 1},
                BATCH_SIZE,
            );
            if (leases.length === 0) break;
            expireLast = leases[leases.length - 1]._id as ObjectId;

            for (const lease of leases) {
                await leaseService.updateByIdOrThrow(
                    lease._id,
                    {$set: {status: LeaseStatus.EXPIRED}},
                    {logger, languageCode, timeOperations: false},
                );
                const companyId = (lease.company as any)?._id ?? lease.company;
                const ctx = {
                    logger,
                    languageCode,
                    company: {_id: companyId as ObjectId},
                };
                await waiveOpenRentalPayments(lease._id, ctx);
                const unitId = unitIdFromLease(lease);
                if (unitId) await releaseUnitIfRented(unitId, ctx);
                expiredCount += 1;
            }

            if (leases.length < BATCH_SIZE) break;
        }

        logger.debug(`Expired ${expiredCount} leases`);
        logger.finish("Rental maintenance complete");
    } catch (err: unknown) {
        logger.err(
            `Rental maintenance failed: ${err instanceof Error ? err.message : String(err)}`,
            err,
        );
        throw err;
    }
}
