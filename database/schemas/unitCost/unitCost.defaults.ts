import {Decimal128, ObjectId} from "mongodb";
import UnitCost from "./unitCost";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {unitCostsSeed} from "@propertyManagement/database/seeds/operations/unitCosts.seed";
import {
    opt,
    optDecimal,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";
import type {
    ExpenditureCategory,
    MeasureUnit,
    UnitCostPaymentStatus,
    UnitCostVerificationStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.constants";

export {unitCostsSeed as defaultUnitCosts};

const PURCHASE_LEAD_DAYS = 20;

function addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
}

/**
 * Payment calendar lists by `paymentDate` in the visible month (current month on first
 * open). Exported seed dates sit in Apr–Jun 2026 and several rows omit `paymentDate`,
 * so those documents would never appear. Spread each row across the current month and
 * always persist a due date.
 */
function demoCalendarDates(index: number, now: Date): {purchaseDate: Date; paymentDate: Date} {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = 1 + ((index * 2) % lastDay);
    const paymentDate = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0, 0);
    return {purchaseDate: addDays(paymentDate, -PURCHASE_LEAD_DAYS), paymentDate};
}

/**
 * Seeds construction and fit-out costs across the hierarchy.
 *
 * The schema requires at least one of unit / floor / edifice / project, so a row whose
 * whole scope failed to seed is skipped rather than written scopeless.
 */
export async function createUnitCosts(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    projectIds: Map<string, ObjectId>,
    edificeIds: Map<string, ObjectId>,
    floorIds: Map<string, ObjectId>,
    unitIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createUnitCosts", parentLogger);
    logger.start(`Creating unit costs (${unitCostsSeed.length})...`);

    const created = new Map<string, ObjectId>();
    const now = new Date();

    for (const [index, row] of unitCostsSeed.entries()) {
        try {
            const unit = row.unit ? unitIds.get(row.unit) : undefined;
            const floor = row.floor ? floorIds.get(row.floor) : undefined;
            const edifice = row.edifice ? edificeIds.get(row.edifice) : undefined;
            const project = projectIds.get(row.project);
            if (!unit && !floor && !edifice && !project) {
                logger.warn(`Skipping unit cost ${row.id}: none of its scope was seeded.`);
                continue;
            }

            const purchasePerson = resolveUser(refs, row.purchasePerson);
            if (!purchasePerson) {
                logger.warn(
                    `Skipping unit cost ${row.id}: purchaser "${row.purchasePerson.$user}" not found.`,
                );
                continue;
            }

            const currency = resolveCurrency(refs, row.currency);
            if (!currency) {
                logger.warn(`Skipping unit cost ${row.id}: currency "${row.currency.$currency}" not found.`);
                continue;
            }

            const costId = new ObjectId(row.id);
            const {purchaseDate, paymentDate} = demoCalendarDates(index, now);
            const payload = {
                ...opt("unit", unit),
                ...opt("floor", floor),
                ...opt("edifice", edifice),
                ...opt("project", project),
                purchasePerson,
                purchaseDate,
                paymentDate,
                notes: row.notes,
                verificationStatus: row.verificationStatus as UnitCostVerificationStatus,
                paymentStatus: row.paymentStatus as UnitCostPaymentStatus,
                tag: row.tag,
                currency,
                invoiceNumber: row.invoiceNumber,
                vendorName: row.vendorName,
                expenditureItems: row.expenditureItems.map((item) => ({
                    title: item.title,
                    category: item.category as ExpenditureCategory,
                    amount: item.amount,
                    unit: item.unit as MeasureUnit,
                    pricePerUnit: Decimal128.fromString(item.pricePerUnit),
                    media: [],
                })),
                ...optDecimal("budgetedAmount", row.budgetedAmount),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await UnitCost.findById(costId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await UnitCost.create({_id: costId, ...payload});
            }

            created.set(row.id, costId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating unit cost ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating unit costs!", created.size);
    return created;
}
