import {Decimal128, ObjectId} from "mongodb";
import Sale, {SalePaymentType} from "./sale";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {salesSeed} from "@propertyManagement/database/seeds/operations/sales.seed";
import {
    opt,
    optDate,
    optDecimal,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {salesSeed as defaultSales};

/**
 * Seeds the demo sales.
 *
 * `paymentPlan` is deliberately left unset here even when the export carries one:
 * the plan does not exist yet at this point, and `createPaymentPlans` links itself
 * back to its sale once it does.
 */
export async function createSales(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    unitIds: Map<string, ObjectId>,
    reservationIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createSales", parentLogger);
    logger.start(`Creating sales (${salesSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of salesSeed) {
        try {
            const unit = unitIds.get(row.unit);
            if (!unit) {
                logger.warn(`Skipping sale ${row.id}: its unit was not seeded.`);
                continue;
            }

            const buyer = resolveUser(refs, row.buyer);
            const soldBy = resolveUser(refs, row.soldBy);
            if (!soldBy) {
                logger.warn(`Skipping sale ${row.id}: seller "${row.soldBy.$user}" not found.`);
                continue;
            }

            const saleCurrency = resolveCurrency(refs, row.saleCurrency);
            if (!saleCurrency) {
                logger.warn(`Skipping sale ${row.id}: currency "${row.saleCurrency.$currency}" not found.`);
                continue;
            }

            const saleId = new ObjectId(row.id);
            const payload = {
                unit,
                paymentType: row.paymentType as SalePaymentType,
                ...opt("buyer", buyer),
                soldBy,
                saleDate: new Date(row.saleDate),
                ...optDecimal("listedUnitPrice", row.listedUnitPrice),
                ...opt("listedUnitCurrency", resolveCurrency(refs, row.listedUnitCurrency)),
                ...optDecimal("saleExchangeRate", row.saleExchangeRate),
                ...optDecimal("localDiscount", row.localDiscount),
                finalPrice: Decimal128.fromString(row.finalPrice),
                saleCurrency,
                notes: row.notes,
                transactionReference: row.transactionReference,
                ...optDate("handoverDate", row.handoverDate),
                ...opt("handedOverBy", resolveUser(refs, row.handedOverBy)),
                ...opt("handoverNotes", row.handoverNotes),
                ...optDate("titleTransferDate", row.titleTransferDate),
                ...opt("deedNumber", row.deedNumber),
                ...opt("notaryName", row.notaryName),
                ...opt("reservation", row.reservation ? reservationIds.get(row.reservation) : undefined),
                ...optDecimal("reservationDepositAmount", row.reservationDepositAmount),
                ...opt("reservationDepositCurrency", resolveCurrency(refs, row.reservationDepositCurrency)),
                ...optDecimal("reservationExchangeRate", row.reservationExchangeRate),
                ...optDecimal("reservationConvertedAmount", row.reservationConvertedAmount),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Sale.findById(saleId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Sale.create({_id: saleId, ...payload});
            }

            created.set(row.id, saleId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating sale ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating sales!", created.size);
    return created;
}
