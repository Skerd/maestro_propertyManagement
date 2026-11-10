import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import PaymentPlan, {
    computePaymentPlanRemainingBalance,
    InstallmentStatus,
    PaymentPlanStatus,
} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import {SaleActions} from "@propertyManagement/database/schemas/sale/sale.actions";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, clearDatabase, dec, decString, seedCurrency, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const params = actor(companyId);
const sales = new SaleActions();

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(() => clearDatabase()));

type Row = {amount: string; principal?: string; interest?: string; status?: InstallmentStatus; paid?: string; due?: string};

/** A sold unit on a plan: 1,000.00 down, then the given installments (principal = amount unless said). */
async function seedPlan(rows: Row[], input: {downPaymentPaid?: boolean; status?: PaymentPlanStatus; totalAmount?: string} = {}) {
    const currency = await seedCurrency(companyId, "CHF");
    const buyer = await seedUser(companyId);
    const saleId = new ObjectId();
    const unitId = await seedUnit(companyId, {price: input.totalAmount ?? "10000.00", priceCurrency: currency, status: UnitStatus.SOLD, sale: saleId});
    await Sale.collection.insertOne({
        _id: saleId, company: companyId, unit: unitId, buyer, soldBy: buyer, paymentType: "payment_plan", saleDate: new Date("2026-01-01"),
        saleCurrency: currency, finalPrice: dec(input.totalAmount ?? "10000.00"), name: "SALE-1", deletedAt: null,
    });
    const plan = await PaymentPlan.create({
        sale: saleId, company: companyId, status: input.status ?? PaymentPlanStatus.ACTIVE,
        totalAmount: dec(input.totalAmount ?? "10000.00"), downPayment: dec("1000.00"), downPaymentPaid: input.downPaymentPaid ?? false,
        remainingBalance: dec("0"), numberOfInstallments: rows.length, installmentAmount: dec("0"), interestRate: 0,
        startDate: new Date("2026-01-01"), endDate: new Date("2026-12-01"),
        installments: rows.map((row, i) => ({
            installmentNumber: i + 1,
            dueDate: new Date(row.due ?? `2026-${String(i + 2).padStart(2, "0")}-01`),
            amount: dec(row.amount), principalAmount: dec(row.principal ?? row.amount), interestAmount: dec(row.interest ?? "0"),
            status: row.status ?? InstallmentStatus.PENDING,
            ...(row.paid ? {paidAmount: dec(row.paid), paymentReceipts: [{amount: dec(row.paid), paidDate: new Date("2026-02-01")}]} : {}),
        })),
    });
    return plan._id;
}

const reload = (id: ObjectId) => asCompany(async () => (await PaymentPlan.findById(id).lean())!);
const pay = (id: ObjectId, installmentNumber: number, paidAmount: number) =>
    asCompany(() => sales.payInstallment({...params, _id: id.toString(), installmentNumber, paidAmount}));

describe("remaining balance", () => {
    it("is everything still owed: down payment and installments with their interest, less what was paid", () => {
        const plan = {
            downPayment: dec("1000.00"),
            downPaymentPaid: true,
            installments: [
                {amount: dec("4100.10"), paidAmount: dec("4100.10"), status: InstallmentStatus.PAID},
                {amount: dec("4100.10"), paidAmount: dec("0.20"), status: InstallmentStatus.PARTIALLY_PAID},
                {amount: dec("999.99"), status: InstallmentStatus.CANCELLED},
            ],
        };
        // Owed 1,000.00 + 4,100.10 + 4,100.10; paid 1,000.00 + 4,100.10 + 0.20
        expect(computePaymentPlanRemainingBalance(plan)).toBe(4099.9);
        expect(computePaymentPlanRemainingBalance({...plan, downPaymentPaid: false})).toBe(5099.9);
    });
});

describe("paying an installment", {timeout: 60000}, () => {
    it("records a partial payment, then the rest, exactly", async () => {
        const planId = await asCompany(() => seedPlan([{amount: "4500.10"}, {amount: "4499.90"}]));
        await pay(planId, 1, 0.1);
        await pay(planId, 1, 0.2);
        let plan = await reload(planId);
        expect([plan.installments[0].status, decString(plan.installments[0].paidAmount)]).toEqual([InstallmentStatus.PARTIALLY_PAID, "0.30"]);

        await pay(planId, 1, 4499.8);
        plan = await reload(planId);
        expect([plan.installments[0].status, decString(plan.installments[0].paidAmount), plan.installments[0].paymentReceipts!.length])
            .toEqual([InstallmentStatus.PAID, "4500.10", 3]);
        expect(decString(plan.remainingBalance)).toBe("5499.9");
    });

    it("refuses more than is due, an installment already paid, and a plan that is no longer open", async () => {
        const planId = await asCompany(() => seedPlan([{amount: "4500.00", paid: "4000.00", status: InstallmentStatus.PARTIALLY_PAID}, {amount: "4500.00", paid: "4500.00", status: InstallmentStatus.PAID}]));
        await expect(pay(planId, 1, 500.01)).rejects.toMatchObject({error_code: "installment_payment_exceeds_due"});
        await expect(pay(planId, 2, 1)).rejects.toMatchObject({error_code: "installment_already_paid"});
        expect(decString((await reload(planId)).installments[0].paidAmount)).toBe("4000.00");

        await asCompany(() => PaymentPlan.collection.updateOne({_id: planId}, {$set: {status: PaymentPlanStatus.CANCELLED}}));
        await expect(pay(planId, 1, 100)).rejects.toMatchObject({error_code: "payment_plan_not_open"});
    });

    it("takes the down payment once", async () => {
        const planId = await asCompany(() => seedPlan([{amount: "9000.00"}]));
        await asCompany(() => sales.payDownPayment({...params, _id: planId.toString()}));
        expect((await reload(planId)).downPaymentPaid).toBe(true);
        await expect(asCompany(() => sales.payDownPayment({...params, _id: planId.toString()})))
            .rejects.toMatchObject({error_code: "down_payment_already_paid"});
    });
});

describe("restructuring a plan", {timeout: 60000}, () => {
    it("keeps the rows that carry payments and re-plans only the principal still unpaid", async () => {
        const planId = await asCompany(() => seedPlan([
            {amount: "3000.00", paid: "3000.00", status: InstallmentStatus.PAID},
            // Overdue but not yet past its due date here, so the plan stays active (restructuring takes active plans).
            {amount: "3000.00", paid: "1000.00", status: InstallmentStatus.OVERDUE, due: "2027-03-01"},
            {amount: "3000.00"},
        ], {downPaymentPaid: true}));

        await asCompany(() => sales.restructurePaymentPlan({
            ...params, _id: planId.toString(), startDate: "2026-06-01", endDate: "2026-08-01", interestRate: 0, reason: "Buyer asked",
            installments: [{installmentNumber: 1, dueDate: "2026-07-01", amount: 1500}, {installmentNumber: 2, dueDate: "2026-08-01", amount: 1500}],
        }));

        const plan = await reload(planId);
        expect(plan.installments.map((row) => [row.installmentNumber, decString(row.amount), row.status, decString(row.paidAmount)])).toEqual([
            [1, "3000.00", InstallmentStatus.PAID, "3000.00"],
            [2, "3000.00", InstallmentStatus.OVERDUE, "1000.00"],
            [3, "1500.00", InstallmentStatus.PENDING, undefined],
            [4, "1500.00", InstallmentStatus.PENDING, undefined],
        ]);
        expect(plan.installments[0].paymentReceipts!.length).toBe(1);
        // Still owed: 2,000.00 on row 2 and the 3,000.00 re-planned
        expect([plan.numberOfInstallments, decString(plan.remainingBalance), plan.startDate.toISOString().slice(0, 10)]).toEqual([4, "5000", "2026-01-01"]);
        expect(plan.restructureHistory![0].previousInstallments).toHaveLength(3);
    });

    it("refuses a new schedule that does not pay off the unpaid principal", async () => {
        const planId = await asCompany(() => seedPlan([{amount: "4500.00", paid: "4500.00", status: InstallmentStatus.PAID}, {amount: "4500.00"}]));
        await expect(asCompany(() => sales.restructurePaymentPlan({
            ...params, _id: planId.toString(), startDate: "2026-06-01", endDate: "2026-07-01", interestRate: 0,
            installments: [{installmentNumber: 1, dueDate: "2026-07-01", amount: 4499.99}],
        }))).rejects.toMatchObject({error_code: "payment_plan_principal_not_covered"});
        expect((await reload(planId)).installments).toHaveLength(2);
    });
});
