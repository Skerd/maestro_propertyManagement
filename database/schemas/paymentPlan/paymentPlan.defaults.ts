import {Decimal128, ObjectId} from "mongodb";
import PaymentPlan, {InstallmentStatus, PaymentPlanStatus} from "./paymentPlan";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {paymentPlansSeed} from "@propertyManagement/database/seeds/operations/paymentPlans.seed";
import {opt, optDate} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {paymentPlansSeed as defaultPaymentPlans};

/**
 * Seeds the demo payment plans and links each one back onto its sale.
 *
 * `Sale.paymentPlan` is write-protected on the API but is a plain path here, and the
 * sale seeder cannot set it (the plan does not exist yet), so the link is closed from
 * this side. `remainingBalance` is recomputed by the schema's pre-save hook; the
 * exported value is passed through only because the path is required.
 */
export async function createPaymentPlans(
    parentLogger: serverLogger,
    company: ICompany,
    saleIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createPaymentPlans", parentLogger);
    logger.start(`Creating payment plans (${paymentPlansSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of paymentPlansSeed) {
        try {
            const sale = saleIds.get(row.sale);
            if (!sale) {
                logger.warn(`Skipping payment plan ${row.id}: its sale was not seeded.`);
                continue;
            }

            const planId = new ObjectId(row.id);
            const payload = {
                sale,
                status: row.status as PaymentPlanStatus,
                totalAmount: Decimal128.fromString(row.totalAmount),
                downPayment: Decimal128.fromString(row.downPayment),
                downPaymentPaid: row.downPaymentPaid,
                ...optDate("downPaymentDate", row.downPaymentDate),
                remainingBalance: Decimal128.fromString(row.remainingBalance),
                numberOfInstallments: row.numberOfInstallments,
                installmentAmount: Decimal128.fromString(row.installmentAmount),
                interestRate: row.interestRate,
                startDate: new Date(row.startDate),
                endDate: new Date(row.endDate),
                installments: row.installments.map((installment) => ({
                    installmentNumber: installment.installmentNumber,
                    dueDate: new Date(installment.dueDate),
                    amount: Decimal128.fromString(installment.amount),
                    principalAmount: Decimal128.fromString(installment.principalAmount),
                    interestAmount: Decimal128.fromString(installment.interestAmount),
                    status: installment.status as InstallmentStatus,
                    ...(installment.paidAmount != null
                        ? {paidAmount: Decimal128.fromString(installment.paidAmount)}
                        : {}),
                    ...optDate("paidDate", installment.paidDate),
                    ...opt("notes", installment.notes),
                })),
                gracePeriodDays: row.gracePeriodDays,
                lateFeePercentage: row.lateFeePercentage,
                notes: row.notes,
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await PaymentPlan.findById(planId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await PaymentPlan.create({_id: planId, ...payload});
            }

            await Sale.updateOne({_id: sale}, {$set: {paymentPlan: planId}});

            created.set(row.id, planId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating payment plan ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating payment plans!", created.size);
    return created;
}
