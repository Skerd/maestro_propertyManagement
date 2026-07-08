
export const PaymentPlanSimpleSnippet = {
    keys: {
        name: {}
    }
}

export const PaymentPlanSnippet = {
    keys: {
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
                notes: {}
            }
        }
    }
};