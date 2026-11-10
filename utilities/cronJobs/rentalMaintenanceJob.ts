/**
 * Daily rental maintenance:
 *  - mark pending/partially_paid past due (+ lease grace days) as overdue when remaining > 0
 *  - stamp lateFeeAmount once from lease.lateFeePercentage
 *  - expire active leases past endDate, waive open payments, release units (each lease in its own transaction)
 *
 * "Today" is the calendar day in the company timezone (GLB-09, D91); `dueDate` and `endDate` are calendar values
 * stored at midnight UTC, so their day is read in UTC.
 */

import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ObjectId} from "mongodb";
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {companyTodayOf} from "@coreModule/utilities/time/companyTimeZone";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
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
import {endLease} from "../../database/schemas/lease/lease.helper";

const BATCH_SIZE = 200;
const lang = () => CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";

/** When the job runs; tests pin it. "Today" is taken in the company's timezone (D91). */
export type RentalMaintenanceClock = {now?: Date};

export async function runRentalMaintenance(company: ObjectId, parentLogger?: serverLogger, clock: RentalMaintenanceClock = {}): Promise<void> {
    const logger = getLogger("rentalMaintenanceJob", parentLogger);
    logger.start("Running rental maintenance...");
    const languageCode = lang();
    const today = await companyTodayOf(company, {now: clock.now});

    try {
        let lastId: ObjectId | undefined;
        let overdueCount = 0;
        while (true) {
            const filter: Record<string, unknown> = {
                company,
                status: {$in: [...OPEN_RENT_STATUSES]},
            };
            if (lastId) filter._id = {$gt: lastId};
            const payments = await rentalPaymentService.find(
                filter,
                {withDeleted: false, logger, languageCode, timeOperations: false},
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
                if (!payment.dueDate) continue;
                // Overdue once the last grace day (due day + grace days) is before the company's today.
                if (addLocalDays(payment.dueDate, graceDays) >= today) continue;

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
        while (true) {
            const filter: Record<string, unknown> = {
                company,
                status: LeaseStatus.ACTIVE,
                // Lease days are local `YYYY-MM-DD` strings (D115): they compare as text.
                endDate: {$lt: today},
            };
            if (expireLast) filter._id = {$gt: expireLast};
            const leases = await leaseService.find(
                filter,
                {withDeleted: false, logger, languageCode, timeOperations: false},
                [],
                "_id",
                {_id: 1},
                BATCH_SIZE,
            );
            if (leases.length === 0) break;
            expireLast = leases[leases.length - 1]._id as ObjectId;

            for (const {_id} of leases) {
                try {
                    const done = await runInTransaction(logger, async (session) => {
                        // Re-read inside the transaction: it may have been terminated or extended meanwhile.
                        const lease = await leaseService.findOne(
                            {_id, company, status: LeaseStatus.ACTIVE, endDate: {$lt: today}},
                            {session, logger, languageCode, timeOperations: false},
                        );
                        if (!lease) return false;
                        await endLease(lease, {status: LeaseStatus.EXPIRED}, {session, logger, languageCode, companyId: company});
                        return true;
                    });
                    if (done) expiredCount += 1;
                } catch (e: unknown) {
                    logger.err(`Lease expiry failed for ${_id.toString()}`, e);
                }
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
