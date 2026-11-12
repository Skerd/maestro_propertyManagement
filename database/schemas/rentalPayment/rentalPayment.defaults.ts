import {ObjectId} from "mongodb";
import RentalPayment from "./rentalPayment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {CONSTANTS} from "@coreModule/environment";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {companyTimeZone} from "@coreModule/utilities/time/companyTimeZone";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {leasesSeed} from "@propertyManagement/database/seeds/operations/leases.seed";
import {LeaseActions} from "@propertyManagement/database/schemas/lease/lease.actions";
import {hasCollectedCash, moneyNumber} from "@propertyManagement/utilities/lease/rentRemaining";

/**
 * Pays the demo leases' rent the way staff record it, through the lease's record-payment action: each month already
 * due is paid on its due day, except the latest `unpaidDueMonths`, which stay open. The rent rows themselves come from
 * the lease schedule (`createLeases`). A lease that has collected any rent is left alone, so a re-run pays nothing twice.
 */
export async function createRentalPayments(
    parentLogger: serverLogger,
    company: ICompany,
    leaseIds: Map<string, ObjectId>,
): Promise<number> {
    const logger = getLogger("mongoDbInitialization-createRentalPayments", parentLogger);
    logger.start("Recording demo rent payments...");

    const creator = nestedEntityToRef(company.createdBy);
    if (!creator) {
        logger.warn(`'${company.name}' has no creator to record the rent payments as; skipping.`);
        return 0;
    }
    const companyId = company._id.toString();
    const today = localDateOf(new Date(), companyTimeZone(company));
    const params = {
        logger,
        languageCode: CONSTANTS.DEFAULT_LANGUAGE ?? "en-US",
        company,
        actionUserCtx: {userId: creator.toString(), orgId: companyId, isAdmin: true, isSelf: false, permissions: []},
    };
    const leases = new LeaseActions();
    let recorded = 0;

    for (const row of leasesSeed) {
        const leaseId = leaseIds.get(row.id);
        if (!leaseId) continue;
        try {
            const months = await RentalPayment.find({lease: leaseId, company: company._id}).sort({dueDate: 1});
            if (months.some((month) => hasCollectedCash(month))) {
                logger.info(`Lease ${row.id} already has rent paid; leaving it.`);
                continue;
            }
            const due = months.filter((month) => month.dueDate <= today);
            for (const month of due.slice(0, Math.max(0, due.length - row.unpaidDueMonths))) {
                await leases.recordRentPayment({...params, _id: leaseId.toString(), paidAmount: moneyNumber(month.amount), paidDate: month.dueDate});
                recorded += 1;
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.err(`Error recording rent for lease ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished recording demo rent payments!", recorded);
    return recorded;
}
