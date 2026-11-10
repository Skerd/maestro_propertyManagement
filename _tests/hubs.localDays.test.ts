/**
 * Calendar days are local `YYYY-MM-DD` strings (D115): the hubs bound a month by its first and last day and compare
 * as text, in memory (payments hub) and in Mongo (rentals hub), and "today" is the company's (GLB-09).
 */
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
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
import * as rentalsHubRoute from "@propertyManagement/api/realEstate/private/rentalsHub";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import type {PaymentsHubRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {inDayRange, monthDayRange, parseDayRange} from "../utilities/hubShared/dayRange";
import {asTenant, clearDatabase, dec, seedCurrency, seedLease, seedRentRow, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([
    {...paymentsHubRoute, module: "propertyManagement"},
    {...rentalsHubRoute, module: "propertyManagement"},
]);

/** The month's edges and the days just outside them. */
const DUES = ["2026-02-28", "2026-03-01", "2026-03-31", "2026-04-01"];

let manager: TestCaller;

beforeAll(async () => {
    await connectTestDatabase();
    manager = {
        userId: new ObjectId().toString(),
        companyId: companyId.toString(),
        permissions: allPermissionTags([PaymentPlan, Sale, Unit, User, Currency, Lease, RentalPayment]),
        timeZone: "Europe/Zurich",
    };
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(() => clearDatabase()));

async function seedPlan(dues: string[]): Promise<void> {
    const currency = await seedCurrency(companyId, "CHF");
    const buyer = await seedUser(companyId, "Ana");
    const unit = await seedUnit(companyId, {price: "4000.00", priceCurrency: currency, status: UnitStatus.SOLD});
    const saleId = new ObjectId();
    const db = mongoose.connection.db!;
    await db.collection("sales").insertOne({
        _id: saleId, company: companyId, name: "SALE-0001", unit, buyer, saleCurrency: currency,
        paymentType: "payment_plan", finalPrice: dec("4000.00"), saleDate: "2026-01-15", deletedAt: null,
    });
    await db.collection("paymentplans").insertOne({
        _id: new ObjectId(), company: companyId, name: "PLAN-0001", sale: saleId, status: "active",
        totalAmount: dec("4000.00"), downPayment: dec("0"), downPaymentPaid: true, remainingBalance: dec("4000.00"),
        numberOfInstallments: dues.length, installmentAmount: dec("4000.00"),
        startDate: "2026-01-15", endDate: dues[dues.length - 1],
        installments: dues.map((dueDate, i) => ({
            installmentNumber: i + 1, dueDate,
            amount: dec("1000.00"), principalAmount: dec("1000.00"), interestAmount: dec("0.00"), status: "pending",
        })),
        deletedAt: null,
    });
}

describe("hub day ranges (pure)", () => {
    it("bounds a month by its first and last day, February and long months alike", () => {
        expect(monthDayRange("2026-02")).toEqual({from: "2026-02-01", to: "2026-02-28"});
        expect(monthDayRange("2028-02")).toEqual({from: "2028-02-01", to: "2028-02-29"});
        expect(monthDayRange("2026-03")).toEqual({from: "2026-03-01", to: "2026-03-31"});
        expect(DUES.filter((day) => inDayRange(day, monthDayRange("2026-03")))).toEqual(["2026-03-01", "2026-03-31"]);
    });

    it("reads filter bounds as days and ignores anything else", () => {
        expect(parseDayRange("2026-03-01T22:00:00.000Z", "garbage")).toEqual({from: "2026-03-01", to: undefined});
        expect(inDayRange(undefined, {})).toBe(true);
        expect(inDayRange(undefined, {from: "2026-03-01"})).toBe(false);
    });
});

describe("payments hub on local days", {timeout: 60000}, () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("puts a month's first and last due day in its calendar and the days around it outside", async () => {
        await asCompany(() => seedPlan(DUES));

        const response = await request(app).post("/api/realEstate/paymentsHub/payments/calendar")
            .set(callerHeader(manager)).send({month: "2026-03"});

        expect(response.status).toBe(200);
        expect((response.body.payments as PaymentsHubRow[]).map((row) => row.dueDate)).toEqual(["2026-03-01", "2026-03-31"]);
    });

    it("returns due days as stored and filters a date range by day, both ends included", async () => {
        await asCompany(() => seedPlan(DUES));

        const response = await request(app).post("/api/realEstate/paymentsHub/payments/list")
            .set(callerHeader(manager)).send({page: 1, limit: 10, dateField: "dueDate", dateFrom: "2026-02-28", dateTo: "2026-03-31"});

        expect(response.status).toBe(200);
        expect((response.body.data as PaymentsHubRow[]).map((row) => row.dueDate)).toEqual(["2026-02-28", "2026-03-01", "2026-03-31"]);
    });

    it("counts overdue and the next 7 days from the company's today at 00:30 in Zurich", async () => {
        // 00:30 on 1 March in Zurich, still 28 February in UTC.
        vi.useFakeTimers({now: new Date("2026-02-28T23:30:00Z"), toFake: ["Date"]});
        await asCompany(() => seedPlan(DUES));

        const response = await request(app).post("/api/realEstate/paymentsHub/payments/list")
            .set(callerHeader(manager)).send({page: 1, limit: 10});

        expect(response.status).toBe(200);
        const statusByDue = Object.fromEntries((response.body.data as PaymentsHubRow[]).map((row) => [row.dueDate, row.status]));
        expect(statusByDue).toEqual({"2026-02-28": "overdue", "2026-03-01": "pending", "2026-03-31": "pending", "2026-04-01": "pending"});
    });
});

describe("rentals hub calendar on local days (a Mongo string range)", {timeout: 60000}, () => {
    it("returns the month's first and last due day and nothing outside it", async () => {
        await asCompany(async () => {
            const chf = await seedCurrency(companyId, "CHF");
            const tenant = await seedUser(companyId, "Tenant");
            const unit = await seedUnit(companyId, {price: "300000.00", priceCurrency: chf, status: UnitStatus.RENTED});
            const lease = await seedLease(companyId, {unit, tenant, currency: chf, startDate: "2026-01-01", endDate: "2026-12-31"});
            for (const dueDate of DUES) await seedRentRow(companyId, {lease, unit, currency: chf, dueDate});
        });

        const response = await request(app).post("/api/realEstate/rentalsHub/rentalPayments/calendar")
            .set(callerHeader(manager)).send({month: "2026-03"});

        expect(response.status).toBe(200);
        expect((response.body.payments as {dueDate?: string}[]).map((row) => row.dueDate)).toEqual(["2026-03-01", "2026-03-31"]);
    });
});
