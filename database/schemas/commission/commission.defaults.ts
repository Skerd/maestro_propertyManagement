import {Decimal128, ObjectId} from "mongodb";
import Commission, {CommissionSourceType, CommissionStatus} from "./commission";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {commissionsSeed} from "@propertyManagement/database/seeds/operations/commissions.seed";
import {
    opt,
    optDate,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {commissionsSeed as defaultCommissions};

/**
 * Seeds agent commissions earned off the demo reservations and sales.
 *
 * `sourceId` is an untyped ObjectId that mirrors whichever of `reservation` / `sale`
 * the row names, so it is resolved through the same map rather than copied verbatim —
 * a commission whose source did not seed is dropped instead of left dangling.
 */
export async function createCommissions(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    reservationIds: Map<string, ObjectId>,
    saleIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createCommissions", parentLogger);
    logger.start(`Creating commissions (${commissionsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of commissionsSeed) {
        try {
            const sourceMap =
                row.sourceType === CommissionSourceType.SALE ? saleIds : reservationIds;
            const sourceId = sourceMap.get(row.sourceId);
            if (!sourceId) {
                logger.warn(`Skipping commission ${row.id}: its ${row.sourceType} was not seeded.`);
                continue;
            }

            const agent = resolveUser(refs, row.agent);
            if (!agent) {
                logger.warn(`Skipping commission ${row.id}: agent "${row.agent.$user}" not found.`);
                continue;
            }

            const currency = resolveCurrency(refs, row.currency);
            if (!currency) {
                logger.warn(`Skipping commission ${row.id}: currency "${row.currency.$currency}" not found.`);
                continue;
            }

            const commissionId = new ObjectId(row.id);
            const payload = {
                agent,
                ...opt("recordedByActionUser", resolveUser(refs, row.recordedByActionUser)),
                sourceType: row.sourceType as CommissionSourceType,
                sourceId,
                ...opt("reservation", row.reservation ? reservationIds.get(row.reservation) : undefined),
                ...opt("sale", row.sale ? saleIds.get(row.sale) : undefined),
                basis: row.basis,
                basisAmount: Decimal128.fromString(row.basisAmount),
                ratePercent: row.ratePercent,
                amount: Decimal128.fromString(row.amount),
                currency,
                status: row.status as CommissionStatus,
                notes: row.notes,
                ...optDate("paidAt", row.paidAt),
                ...optDate("voidedAt", row.voidedAt),
                ...opt("paymentReference", row.paymentReference),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Commission.findById(commissionId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Commission.create({_id: commissionId, ...payload});
            }

            created.set(row.id, commissionId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating commission ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating commissions!", created.size);
    return created;
}
