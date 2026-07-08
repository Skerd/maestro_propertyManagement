import {IPaymentPlan} from "../../../database/schemas/paymentPlan/paymentPlan";
import {
    PaymentPlan,
    PaymentPlanInstallment,
    RestructureHistoryEntry,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/paymentPlan.dto";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {
    decimalToNumber,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
} from "@coreModule/utilities/mappers/common.mapper";

function mapPaymentPlanSaleRef(sale: unknown): ReturnType<typeof mapPopulatedRef> {
    if (sale == null) return undefined;
    if (typeof sale === "object" && sale !== null && "_id" in sale) {
        return mapPopulatedRef(sale);
    }
    const id =
        typeof sale === "object" && sale !== null && "toString" in sale
            ? String(sale)
            : typeof sale === "string"
              ? sale
              : undefined;
    return id ? {_id: id, name: undefined as unknown as string} : undefined;
}

function mapInstallment(installment: any): PaymentPlanInstallment {
    return {
        installmentNumber: installment.installmentNumber,
        dueDate: installment.dueDate ? new Date(installment.dueDate).toISOString() : new Date().toISOString(),
        amount: decimalToNumber(installment.amount),
        principalAmount: decimalToNumber(installment.principalAmount),
        interestAmount: decimalToNumber(installment.interestAmount),
        status: installment.status,
        paidAmount: decimalToNumber(installment.paidAmount),
        paidDate: installment.paidDate ? new Date(installment.paidDate).toISOString() : undefined,
        transactionId: installment.transactionId,
        notes: installment.notes,
        installmentReminderEmailAt3d: installment.installmentReminderEmailAt3d
            ? new Date(installment.installmentReminderEmailAt3d).toISOString()
            : undefined,
        installmentReminderEmailAt1d: installment.installmentReminderEmailAt1d
            ? new Date(installment.installmentReminderEmailAt1d).toISOString()
            : undefined,
        installmentReminderEmailAt0d: installment.installmentReminderEmailAt0d
            ? new Date(installment.installmentReminderEmailAt0d).toISOString()
            : undefined,
        installmentOverdueNoticeEmailAt: installment.installmentOverdueNoticeEmailAt
            ? new Date(installment.installmentOverdueNoticeEmailAt).toISOString()
            : undefined,
    };
}

export function paymentPlanToDTO(plan: IPaymentPlan | any): PaymentPlan {
    const saleDoc =
        plan.sale && typeof plan.sale === "object" && plan.sale !== null && "_id" in plan.sale
            ? plan.sale
            : undefined;
    return {
        _id: plan._id.toString(),
        name: plan.name,
        sale: mapPaymentPlanSaleRef(plan.sale),
        saleCurrency: mapPopulatedSimpleCurrency(saleDoc?.saleCurrency),
        status: plan.status,
        totalAmount: decimalToNumber(plan.totalAmount),
        downPayment: decimalToNumber(plan.downPayment),
        downPaymentPaid: plan.downPaymentPaid,
        downPaymentDate: plan.downPaymentDate ? new Date(plan.downPaymentDate).toISOString() : undefined,
        remainingBalance: decimalToNumber(plan.remainingBalance),
        numberOfInstallments: plan.numberOfInstallments,
        installmentAmount: decimalToNumber(plan.installmentAmount),
        interestRate: plan.interestRate,
        startDate: plan.startDate ? new Date(plan.startDate).toISOString() : new Date().toISOString(),
        endDate: plan.endDate ? new Date(plan.endDate).toISOString() : new Date().toISOString(),
        installments: !!plan.installments ? plan.installments?.map(mapInstallment) : [],
        gracePeriodDays: plan.gracePeriodDays,
        lateFeePercentage: plan.lateFeePercentage,
        notes: plan.notes,
        restructureHistory: Array.isArray(plan.restructureHistory) && plan.restructureHistory.length > 0
            ? plan.restructureHistory.map((entry: any): RestructureHistoryEntry => ({
                restructuredAt:              entry.restructuredAt ? new Date(entry.restructuredAt).toISOString() : new Date().toISOString(),
                restructuredBy:              entry.restructuredBy ? {_id: (entry.restructuredBy as any)?._id?.toString() ?? entry.restructuredBy.toString(), name: (entry.restructuredBy as any)?.name, surname: (entry.restructuredBy as any)?.surname} : undefined,
                reason:                      entry.reason,
                previousNumberOfInstallments:entry.previousNumberOfInstallments,
                previousStartDate:           entry.previousStartDate ? new Date(entry.previousStartDate).toISOString() : "",
                previousEndDate:             entry.previousEndDate ? new Date(entry.previousEndDate).toISOString() : "",
                previousInterestRate:        entry.previousInterestRate,
                previousInstallments:        Array.isArray(entry.previousInstallments) ? entry.previousInstallments.map(mapInstallment) : [],
            }))
            : undefined,
        ...mapSoftDeleteToDTO(plan),
        ...mapOwnershipToDTO(plan)
    };
}

export function paymentPlansToDTO(plans: IPaymentPlan[]): PaymentPlan[] {
    return plans.map(paymentPlanToDTO);
}
