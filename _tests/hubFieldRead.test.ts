/**
 * Field-level read on the hubs (SEC-09): the payments hub returns a row's amounts and buyer only to a caller whose
 * role may read those fields; the rest of the row, and the row itself, stay. The contracts and rentals hubs neither
 * show nor filter by a field the caller may not read (TD-B167), and the contracts hub's money is exact (TD-B166).
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
import * as contractsHubRoute from "@propertyManagement/api/realEstate/private/contractsHub";
import * as rentalsHubRoute from "@propertyManagement/api/realEstate/private/rentalsHub";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import Lease from "@propertyManagement/database/schemas/lease/lease";
// The contracts hub populates a unit's type: its model must be registered.
import "@propertyManagement/database/schemas/unitType/unitType";
import type {ContractRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.contract.dto";
import type {ClientRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.client.dto";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import type {PaymentsHubRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {asTenant, clearDatabase, dec, seedCurrency, seedLease, seedRentRow, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([
    {...paymentsHubRoute, module: "propertyManagement"},
    {...contractsHubRoute, module: "propertyManagement"},
    {...rentalsHubRoute, module: "propertyManagement"},
]);

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
        downPaymentDate: "2026-01-15", remainingBalance: dec("150000.00"),
        numberOfInstallments: 1, installmentAmount: dec("150000.00"),
        startDate: "2026-01-15", endDate: "2026-12-15",
        installments: [{
            installmentNumber: 1, dueDate: "2026-12-15",
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

describe("contracts and rentals hubs: hidden fields and exact money", {timeout: 60000}, () => {
    const allTags = () => allPermissionTags([PaymentPlan, Sale, Unit, User, Currency, Reservation, RentalPayment, Lease]);
    const callerWithout = (hidden: string[]): TestCaller => {
        const tags = allTags();
        for (const tag of hidden) expect(tags).toContain(tag);
        return {userId: new ObjectId().toString(), companyId: companyId.toString(), permissions: tags.filter((tag) => !hidden.includes(tag))};
    };

    it("does not show or filter by a sale's payment type the caller may not read", async () => {
        await seedPlanWithSale();
        const contracts = (caller: TestCaller) => request(app)
            .post("/api/realEstate/contractsHub/contracts/list")
            .set(callerHeader(caller))
            .send({page: 1, limit: 10, contractType: "cash_sale"});

        const asManager = await contracts(callerWithout([]));
        const asClerk = await contracts(callerWithout(["sales[read:paymentType]"]));

        // The only sale is a payment-plan sale: filtered out by its type, but the type is no filter when it is hidden.
        expect(asManager.body.total).toBe(0);
        const rows: ContractRegistryRow[] = asClerk.body.data;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({sourceType: "sale", contractNumber: "SALE-0001"});
        expect(rows[0]).not.toHaveProperty("contractType");
    });

    it("works out a reservation's remaining price exactly, and never across two currencies", async () => {
        const chf = await seedCurrency(companyId, "CHF");
        const eur = await seedCurrency(companyId, "EUR");
        const client = await seedUser(companyId, "Ana");
        const sameCurrencyUnit = await seedUnit(companyId, {price: "1000.30", priceCurrency: chf, status: UnitStatus.RESERVED});
        const otherCurrencyUnit = await seedUnit(companyId, {price: "2000.00", priceCurrency: chf, status: UnitStatus.RESERVED});
        // Paid deposits: only a paid one counts as paid and comes off the price (D127).
        await seedReservation(companyId, {unit: sameCurrencyUnit, client, depositAmount: "0.10", depositCurrency: chf, paid: true});
        await seedReservation(companyId, {unit: otherCurrencyUnit, client, depositAmount: "100.00", depositCurrency: eur, paid: true});

        const response = await request(app)
            .post("/api/realEstate/contractsHub/clients/list")
            .set(callerHeader(callerWithout([])))
            .send({page: 1, limit: 10});

        expect(response.status).toBe(200);
        const rows: ClientRegistryRow[] = response.body.data;
        const rowOf = (unit: ObjectId) => rows.find((row) => row.unitId === unit.toString())!;
        // 1000.30 − 0.10 is 1000.20; float subtraction gives 1000.1999999999999.
        expect(rowOf(sameCurrencyUnit)).toMatchObject({unitValue: 1000.3, paid: 0.1, remaining: 1000.2});
        expect(rowOf(otherCurrencyUnit)).toMatchObject({unitValue: 2000});
        expect(rowOf(otherCurrencyUnit)).not.toHaveProperty("paid");
        expect(rowOf(otherCurrencyUnit)).not.toHaveProperty("remaining");
    });

    it("lists a client by a live reservation only; an expired one stays in Contracts (D166)", async () => {
        const chf = await seedCurrency(companyId, "CHF");
        const client = await seedUser(companyId, "Mira");
        const liveUnit = await seedUnit(companyId, {price: "500.00", priceCurrency: chf, status: UnitStatus.RESERVED});
        const lapsedUnit = await seedUnit(companyId, {price: "600.00", priceCurrency: chf, status: UnitStatus.AVAILABLE});
        await seedReservation(companyId, {unit: liveUnit, client});
        const expired = await seedReservation(companyId, {unit: lapsedUnit, client, status: "expired", isActive: false});
        const post = (url: string) => request(app).post(url).set(callerHeader(callerWithout([]))).send({page: 1, limit: 50});

        const clients: ClientRegistryRow[] = (await post("/api/realEstate/contractsHub/clients/list")).body.data;
        expect(clients.some((row) => row.unitId === liveUnit.toString())).toBe(true);
        expect(clients.some((row) => row.unitId === lapsedUnit.toString())).toBe(false);

        const contracts: ContractRegistryRow[] = (await post("/api/realEstate/contractsHub/contracts/list")).body.data;
        expect(contracts.some((row) => row.sourceId === expired.toString())).toBe(true);
    });

    it("leaves the rent calendar's month empty for a caller who may not read the due day", async () => {
        const chf = await seedCurrency(companyId, "CHF");
        const tenant = await seedUser(companyId, "Ana");
        const unit = await seedUnit(companyId, {price: "90000.00", priceCurrency: chf, status: UnitStatus.RENTED});
        const lease = await seedLease(companyId, {unit, tenant, currency: chf, startDate: "2026-01-01", endDate: "2026-12-31"});
        await seedRentRow(companyId, {lease, unit, currency: chf, dueDate: "2026-06-01", paidAmount: "200.00"});
        const calendar = (caller: TestCaller) => request(app)
            .post("/api/realEstate/rentalsHub/rentalPayments/calendar")
            .set(callerHeader(caller))
            .send({month: "2026-06"});

        const asManager = await calendar(callerWithout([]));
        const asClerk = await calendar(callerWithout(["rentalpayments[read:dueDate]"]));

        expect(asManager.status).toBe(200);
        expect(asManager.body.payments).toHaveLength(1);
        expect(asClerk.status).toBe(200);
        expect(asClerk.body.payments).toEqual([]);
        // The KPIs do not depend on the due day and stay.
        expect(asClerk.body.kpis.collectedAmount).toEqual([expect.objectContaining({value: 200})]);
    });
});
