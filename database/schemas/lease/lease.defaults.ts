import {Decimal128, ObjectId} from "mongodb";
import Lease, {LeaseStatus} from "./lease";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {leasesSeed} from "@propertyManagement/database/seeds/operations/leases.seed";
import {
    opt,
    optDate,
    optDecimal,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {leasesSeed as defaultLeases};

/**
 * Seeds the demo leases. Only `status: "active"` leases rent their unit out; expired
 * and terminated ones deliberately leave the unit free, which is what reproduces the
 * live availability split.
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
                startDate: new Date(row.startDate),
                endDate: new Date(row.endDate),
                monthlyRent: Decimal128.fromString(row.monthlyRent),
                rentCurrency,
                ...optDecimal("depositAmount", row.depositAmount),
                depositPaid: row.depositPaid,
                ...optDate("depositReturnedAt", row.depositReturnedAt),
                status: row.status as LeaseStatus,
                ...optDate("terminationDate", row.terminationDate),
                ...opt("terminationReason", row.terminationReason),
                notes: row.notes,
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Lease.findById(leaseId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Lease.create({_id: leaseId, ...payload});
            }

            created.set(row.id, leaseId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating lease ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating leases!", created.size);
    return created;
}
