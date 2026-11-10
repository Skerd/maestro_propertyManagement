/**
 * Field-level read on the hubs (SEC-09): the payments hub returns a row's amounts and buyer only to a caller whose
 * role may read those fields; the rest of the row, and the row itself, stay.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import User from "@coreModule/database/schemas/user/user";
import Currency from "@coreModule/database/schemas/currency/currency";
import * as paymentsHubRoute from "@propertyManagement/api/realEstate/private/paymentsHub";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import type {PaymentsHubRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {asTenant, clearDatabase, dec, seedCurrency, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([{...paymentsHubRoute, module: "propertyManagement"}]);

/** Read tags a role without access to the plan's money and the sale's buyer lacks. */
const HIDDEN_READS = [
    "paymentplans[read:downPayment]",
    "paymentplans[read:installments_amount]",
    "paymentplans[read:installments_paidAmount]",
    "paymentplans[read:installments_lateFeeAmount]",
    "sales[read:buyer]",
];

let manager: TestCaller;
let clerk: TestCaller;

beforeAll(async () => {
    await connectTestDatabase();
    const tags = allPermissionTags([PaymentPlan, Sale, Unit, User, Currency]);
    for (const tag of HIDDEN_READS) expect(tags).toContain(tag);
    manager = {userId: new ObjectId().toString(), companyId: companyId.toString(), permissions: tags};
    clerk = {
        userId: new ObjectId().toString(),
        companyId: companyId.toString(),
        permissions: tags.filter((tag) => !HIDDEN_READS.includes(tag)),
    };
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(() => clearDatabase()));

async function seedPlanWithSale(): Promise<void> {
    const currency = await seedCurrency(companyId, "CHF");
    const buyer = await seedUser(companyId, "Ana");
    const unit = await seedUnit(companyId, {price: "200000.00", priceCurrency: currency, status: UnitStatus.SOLD});
    const saleId = new ObjectId();
    const db = mongoose.connection.db!;
    await db.collection("sales").insertOne({
        _id: saleId, company: companyId, name: "SALE-0001", unit, buyer, saleCurrency: currency,
        paymentType: "payment_plan", finalPrice: dec("200000.00"), deletedAt: null,
    });
    await db.collection("paymentplans").insertOne({
        _id: new ObjectId(), company: companyId, name: "PLAN-0001", sale: saleId, status: "active",
        totalAmount: dec("200000.00"), downPayment: dec("50000.00"), downPaymentPaid: true,
        downPaymentDate: new Date("2026-01-15T00:00:00.000Z"), remainingBalance: dec("150000.00"),
        numberOfInstallments: 1, installmentAmount: dec("150000.00"),
        startDate: new Date("2026-01-15T00:00:00.000Z"), endDate: new Date("2026-12-15T00:00:00.000Z"),
        installments: [{
            installmentNumber: 1, dueDate: new Date("2026-12-15T00:00:00.000Z"),
            amount: dec("150000.00"), principalAmount: dec("150000.00"), interestAmount: dec("0.00"),
            status: "pending", paidAmount: dec("1000.00"),
        }],
        deletedAt: null,
    });
}

const list = (caller: TestCaller, search?: string) => request(app)
    .post("/api/realEstate/paymentsHub/payments/list")
    .set(callerHeader(caller))
    .send({page: 1, limit: 10, ...(search ? {search} : {})});

const byKind = (rows: PaymentsHubRow[], kind: PaymentsHubRow["kind"]) => rows.find((row) => row.kind === kind)!;

describe("payments hub field-level read", {timeout: 60000}, () => {
    it("returns amounts, buyer and totals to a role that may read them", async () => {
        await seedPlanWithSale();

        const response = await list(manager);

        expect(response.status).toBe(200);
        const rows: PaymentsHubRow[] = response.body.data;
        expect(rows).toHaveLength(2);
        expect(byKind(rows, "down_payment")).toMatchObject({amount: 50000, paidAmount: 50000, remaining: 0});
        expect(byKind(rows, "installment")).toMatchObject({amount: 150000, paidAmount: 1000, remaining: 149000});
        expect(byKind(rows, "installment").client).toMatchObject({name: "Ana"});
        expect(response.body.totals.expectedAmount).toEqual([expect.objectContaining({value: 200000})]);
    });

    it("leaves amounts, buyer and money totals out for a role that may not read them, and keeps the rest", async () => {
        await seedPlanWithSale();

        const response = await list(clerk);

        expect(response.status).toBe(200);
        const rows: PaymentsHubRow[] = response.body.data;
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row).not.toHaveProperty("amount");
            expect(row).not.toHaveProperty("paidAmount");
            expect(row).not.toHaveProperty("remaining");
            expect(row).not.toHaveProperty("client");
            expect(row).toMatchObject({planCode: "PLAN-0001", saleCode: "SALE-0001", currency: expect.objectContaining({symbol: "CHF"})});
            expect(row.unit).toBeDefined();
            expect(row.dueDate).toBeDefined();
        }
        expect(byKind(rows, "installment").installmentNumber).toBe(1);
        expect(response.body.totals).toEqual({expectedAmount: [], paidAmount: [], outstandingAmount: []});
    });

    it("does not find a row by its hidden buyer's name", async () => {
        await seedPlanWithSale();

        const asManager = await list(manager, "Ana");
        const asClerk = await list(clerk, "Ana");

        expect(asManager.body.total).toBe(2);
        expect(asClerk.body.total).toBe(0);
    });

    it("leaves the money KPIs empty for a role that may not read the amounts", async () => {
        await seedPlanWithSale();

        const response = await request(app)
            .post("/api/realEstate/paymentsHub/payments/summary")
            .set(callerHeader(clerk))
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.kpis).toEqual({
            overdueAmount: [],
            dueNext7DaysAmount: [],
            dueNext30DaysAmount: [],
            collectedThisMonthAmount: [],
        });
    });
});
