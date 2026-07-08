/**
 * Daily rental maintenance:
 *  - mark pending payments past due as overdue
 *  - expire active leases past endDate, waive open payments, release units
 */

import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import Lease, {LeaseStatus} from "../../database/schemas/lease/lease";
import RentalPayment, {RentalPaymentStatus} from "../../database/schemas/rentalPayment/rentalPayment";
import Unit, {UnitStatus} from "../../database/schemas/unit/unit";

const BATCH_SIZE = 200;

function utcStartOfToday(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export async function runRentalMaintenance(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("rentalMaintenanceJob", parentLogger);
    logger.start("Running rental maintenance...");

    const todayStart = utcStartOfToday();

    try {
        const overdueResult = await RentalPayment.updateMany(
            {
                status: RentalPaymentStatus.PENDING,
                dueDate: {$lt: todayStart},
                deletedAt: null,
            },
            {$set: {status: RentalPaymentStatus.OVERDUE}},
        );
        logger.debug(`Marked ${overdueResult.modifiedCount} rental payments overdue`);

        let expiredCount = 0;
        let hasMore = true;
        while (hasMore) {
            const leases = await Lease.find({
                status: LeaseStatus.ACTIVE,
                endDate: {$lt: todayStart},
                deletedAt: null,
            })
                .select("_id unit company")
                .limit(BATCH_SIZE)
                .lean();

            if (leases.length === 0) {
                hasMore = false;
                break;
            }

            for (const lease of leases) {
                await Lease.updateOne(
                    {_id: lease._id, status: LeaseStatus.ACTIVE},
                    {$set: {status: LeaseStatus.EXPIRED}},
                );
                await RentalPayment.updateMany(
                    {
                        lease: lease._id,
                        status: {$in: [RentalPaymentStatus.PENDING, RentalPaymentStatus.OVERDUE]},
                        deletedAt: null,
                    },
                    {$set: {status: RentalPaymentStatus.WAIVED}},
                );
                const unitId = (lease.unit as any)?._id ?? lease.unit;
                if (unitId) {
                    await Unit.updateOne(
                        {_id: unitId, status: UnitStatus.RENTED},
                        {$set: {status: UnitStatus.AVAILABLE}},
                    );
                }
                expiredCount += 1;
            }

            if (leases.length < BATCH_SIZE) hasMore = false;
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
