import {Decimal128, ObjectId} from "mongodb";
import Lease, {LeaseStatus} from "./lease";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {leasesSeed} from "@propertyManagement/database/seeds/operations/leases.seed";
import {
    optDecimal,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";
import {CONSTANTS} from "@coreModule/environment";
import {generateLeaseSchedule, resyncLeaseSchedule} from "@propertyManagement/utilities/lease/leaseScheduleResync";

export {leasesSeed as defaultLeases};

/**
 * Seeds the demo leases, active like a lease the API creates. Their rent rows come from the
 * API's own schedule: generated when the lease is created, resynced when a re-run changes it.
 */
export async function createLeases(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    unitIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createLeases", parentLogger);
    logger.start(`Creating leases (${leasesSeed.length})...`);

    const created = new Map<string, ObjectId>();
    const ctx = {logger, languageCode: CONSTANTS.DEFAULT_LANGUAGE ?? "en-US", company: {_id: company._id}};

    for (const row of leasesSeed) {
        try {
            const unit = unitIds.get(row.unit);
            if (!unit) {
                logger.warn(`Skipping lease ${row.id}: its unit was not seeded.`);
                continue;
            }

            const tenant = resolveUser(refs, row.tenant);
            if (!tenant) {
                logger.warn(`Skipping lease ${row.id}: tenant "${row.tenant.$user}" not found.`);
                continue;
            }

            const rentCurrency = resolveCurrency(refs, row.rentCurrency);
            if (!rentCurrency) {
                logger.warn(`Skipping lease ${row.id}: currency "${row.rentCurrency.$currency}" not found.`);
                continue;
            }

            const leaseId = new ObjectId(row.id);
            const payload = {
                unit,
                tenant,
                startDate: row.startDate,
                endDate: row.endDate,
                monthlyRent: Decimal128.fromString(row.monthlyRent),
                rentCurrency,
                ...optDecimal("depositAmount", row.depositAmount),
                depositPaid: row.depositPaid,
                status: LeaseStatus.ACTIVE,
                notes: row.notes,
                company: company._id,
                createdBy: company.createdBy,
            };

            const previous = await Lease.findById(leaseId);
            if (previous) {
                // A second copy: the resync compares the lease before and after, as the API's update does.
                const existing = await Lease.findById(leaseId);
                if (!existing) continue;
                existing.set(payload);
                await existing.save();
                await resyncLeaseSchedule(previous, existing, ctx);
            } else {
                await generateLeaseSchedule(await Lease.create({_id: leaseId, ...payload}), ctx);
            }

            created.set(row.id, leaseId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.err(`Error creating lease ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating leases!", created.size);
    return created;
}
