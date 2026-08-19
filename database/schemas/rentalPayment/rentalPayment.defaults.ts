import {Decimal128, ObjectId} from "mongodb";
import RentalPayment, {RentalPaymentStatus} from "./rentalPayment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {rentalPaymentsSeed} from "@propertyManagement/database/seeds/operations/rentalPayments.seed";
import {
    optDate,
    optDecimal,
    resolveCurrency,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {rentalPaymentsSeed as defaultRentalPayments};

/** Seeds the rent schedule of each demo lease — paid, pending, overdue and waived months. */
export async function createRentalPayments(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    unitIds: Map<string, ObjectId>,
    leaseIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createRentalPayments", parentLogger);
    logger.start(`Creating rental payments (${rentalPaymentsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of rentalPaymentsSeed) {
        try {
            const lease = leaseIds.get(row.lease);
            const unit = unitIds.get(row.unit);
            if (!lease || !unit) {
                logger.warn(`Skipping rental payment ${row.id}: its lease or unit was not seeded.`);
                continue;
            }

            const currency = resolveCurrency(refs, row.currency);
            if (!currency) {
                logger.warn(
                    `Skipping rental payment ${row.id}: currency "${row.currency.$currency}" not found.`,
                );
                continue;
            }

            const paymentId = new ObjectId(row.id);
            const payload = {
                lease,
                unit,
                dueDate: new Date(row.dueDate),
                amount: Decimal128.fromString(row.amount),
                currency,
                status: row.status as RentalPaymentStatus,
                ...optDate("paidDate", row.paidDate),
                ...optDecimal("paidAmount", row.paidAmount),
                notes: row.notes,
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await RentalPayment.findById(paymentId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await RentalPayment.create({_id: paymentId, ...payload});
            }

            created.set(row.id, paymentId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating rental payment ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating rental payments!", created.size);
    return created;
}
