import type {PaymentPlanDetail, PaymentPlanSimple} from "armonia/src/modules/propertyManagement/dto/paymentPlan.dto";
import type {IPaymentPlan} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const PaymentPlanSimpleSnippet = defineSnippet<IPaymentPlan, PaymentPlanSimple>()({
    keys: {
        _id: {},
        name: {},
    },
});

export const PaymentPlanSnippet = defineSnippet<IPaymentPlan, PaymentPlanDetail>()({
    keys: {
        _id: {},
        name: {},
        status: {},
        totalAmount: {},
        remainingBalance: {},
        installments: {
            keys: {
                installmentNumber: {},
                dueDate: {},
                amount: {},
                principalAmount: {},
                interestAmount: {},
                status: {},
                paidAmount: {},
                paidDate: {},
                transactionId: {},
                notes: {},
            },
        },
    },
});
