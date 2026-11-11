/**
 * The payments hub lists every part of the dashboard's "Collected" (TD-B180): cash sales on their sale day, paid
 * reservation deposits on their paid day, and plan payments on theirs, including what was received on a plan cancelled
 * since. Filtered by paid day as the "Collected" link filters it, the hub's paid total is the KPI. A rejected cash sale
 * is in neither.
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
import * as dashboardRoute from "@propertyManagement/api/realEstate/private/dashboard";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import type {PaymentsHubRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import type {PaymentsListFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.form.type";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {asTenant, clearDatabase, dec, seedCompany, seedCurrency, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;
const app = appFor([
    {...paymentsHubRoute, module: "propertyManagement"},
    {...dashboardRoute, module: "propertyManagement"},
]);

const MAY = {dateFrom: "2026-05-01", dateTo: "2026-05-31"};

let manager: TestCaller;
let withoutReservations: TestCaller;

beforeAll(async () => {
    await connectTestDatabase();
    const base = allPermissionTags([PaymentPlan, Sale, Unit, User, Currency]);
    const caller = (permissions: string[]): TestCaller => ({
        userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true, permissions, timeZone: "Europe/Zurich",
    });
    manager = caller([...base, ...allPermissionTags([Reservation])]);
    withoutReservations = caller(base);
}, 120000);

afterAll(async () => {
    vi.useRealTimers();
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    vi.useRealTimers();
    await clearDatabase();
    await seedCompany(companyId, "Europe/Zurich");
}));

type Seeded = {
    chf: ObjectId;
    edifice: ObjectId;
    approvedCash: ObjectId;
    pendingCash: ObjectId;
    rejectedCash: ObjectId;
    paidDeposit: ObjectId;
    planSale: ObjectId;
    planId: ObjectId;
};

async function insertCashSale(input: {unit: ObjectId; buyer: ObjectId; currency: ObjectId; saleDate: string; finalPrice: string; approvalStatus: string}): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("sales").insertOne({
        _id, company: companyId, name: `SALE-${_id.toString().slice(-6)}`, unit: input.unit, buyer: input.buyer,
        saleCurrency: input.currency, paymentType: "cash", saleDate: input.saleDate, finalPrice: dec(input.finalPrice),
        approvalStatus: input.approvalStatus, deletedAt: null,
    });
    return _id;
}

/**
 * In May, in one edifice: an approved cash sale (1000.50), one pending approval (200), a rejected one (5000), a deposit
 * paid on 15 May on a reservation cancelled since (300), and a plan cancelled since with its down payment paid on
 * 3 May (100) and 400 of its first installment paid on 20 May. Outside May: a deposit with no paid day (reservation
 * day 10 January) and the plan's unpaid second installment. Another edifice has a cash sale in May (999).
 */
async function seedMay(): Promise<Seeded> {
    const chf = await seedCurrency(companyId, "CHF");
    const buyer = await seedUser(companyId, "Ana");
    const edifice = new ObjectId();
    const unitIn = async (status: string, inEdifice = edifice) => {
        const unit = await seedUnit(companyId, {price: "100000.00", priceCurrency: chf, status});
        await db().collection("units").updateOne({_id: unit}, {$set: {edifice: inEdifice}});
        return unit;
    };

    const approvedCash = await insertCashSale({unit: await unitIn(UnitStatus.SOLD), buyer, currency: chf, saleDate: "2026-05-10", finalPrice: "1000.50", approvalStatus: "approved"});
    const pendingCash = await insertCashSale({unit: await unitIn(UnitStatus.SOLD), buyer, currency: chf, saleDate: "2026-05-12", finalPrice: "200.00", approvalStatus: "pending_approval"});
    const rejectedCash = await insertCashSale({unit: await unitIn(UnitStatus.AVAILABLE), buyer, currency: chf, saleDate: "2026-05-11", finalPrice: "5000.00", approvalStatus: "rejected"});
    await insertCashSale({unit: await unitIn(UnitStatus.SOLD, new ObjectId()), buyer, currency: chf, saleDate: "2026-05-14", finalPrice: "999.00", approvalStatus: "approved"});

    const paidDeposit = await seedReservation(companyId, {
        unit: await unitIn(UnitStatus.AVAILABLE), client: buyer, paid: true, isActive: false, status: "cancelled",
        depositAmount: "300.00", depositCurrency: chf,
    });
    await db().collection("reservations").updateOne({_id: paidDeposit}, {$set: {paidDate: "2026-05-15"}});
    await seedReservation(companyId, {unit: await unitIn(UnitStatus.RESERVED), client: buyer, paid: true, depositAmount: "50.00", depositCurrency: chf});
    await seedReservation(companyId, {unit: await unitIn(UnitStatus.RESERVED), client: buyer, paid: false, depositAmount: "999.00", depositCurrency: chf});

    const planSale = new ObjectId();
    const planId = new ObjectId();
    await db().collection("sales").insertOne({
        _id: planSale, company: companyId, name: "SALE-PLAN", unit: await unitIn(UnitStatus.SOLD), buyer, saleCurrency: chf,
        paymentType: "payment_plan", paymentPlan: planId, saleDate: "2026-04-01", finalPrice: dec("2100.00"), approvalStatus: "approved", deletedAt: null,
    });
    await db().collection("paymentplans").insertOne({
        _id: planId, company: companyId, name: "PLAN-0001", sale: planSale, status: "cancelled",
        totalAmount: dec("2100.00"), downPayment: dec("100.00"), downPaymentPaid: true, downPaymentDate: "2026-05-03",
        remainingBalance: dec("1600.00"), numberOfInstallments: 2, installmentAmount: dec("1000.00"),
        startDate: "2026-05-01", endDate: "2026-06-01",
        installments: [
            {installmentNumber: 1, dueDate: "2026-05-15", amount: dec("1000.00"), principalAmount: dec("1000.00"), interestAmount: dec("0.00"),
                status: "partially_paid", paidAmount: dec("400.00"), paidDate: "2026-05-20"},
            {installmentNumber: 2, dueDate: "2026-06-01", amount: dec("1000.00"), principalAmount: dec("1000.00"), interestAmount: dec("0.00"),
                status: "pending"},
        ],
        deletedAt: null,
    });
    return {chf, edifice, approvedCash, pendingCash, rejectedCash, paidDeposit, planSale, planId};
}

const list = (caller: TestCaller, body: PaymentsListFormType) => request(app)
    .post("/api/realEstate/paymentsHub/payments/list")
    .set(callerHeader(caller))
    .send({page: 1, limit: 100, ...body});

const values = (lines: {currencyId: string; value: number}[]) => lines.map(({currencyId, value}) => [currencyId, value]);

describe("payments hub: cash sales and reservation deposits (TD-B180)", {timeout: 60000}, () => {
    it("lists each cash sale as a paid row on its sale day, leaving the rejected one out", () => asCompany(async () => {
        const seeded = await seedMay();

        const response = await list(manager, {kind: "cash_sale", edifice: seeded.edifice.toString()});

        expect(response.status).toBe(200);
        const rows: PaymentsHubRow[] = response.body.data;
        expect(rows.map((row) => row._id).sort()).toEqual([`sale:${seeded.approvedCash}`, `sale:${seeded.pendingCash}`].sort());
        expect(rows.find((row) => row.saleId === seeded.approvedCash.toString())).toMatchObject({
            kind: "cash_sale", status: "paid", dueDate: "2026-05-10", paidDate: "2026-05-10",
            amount: 1000.5, paidAmount: 1000.5, remaining: 0,
            currency: expect.objectContaining({_id: seeded.chf.toString()}), client: expect.objectContaining({name: "Ana"}),
        });
        expect(rows.every((row) => row.planId === undefined)).toBe(true);
    }));

    it("lists each paid deposit on its paid day (else its reservation day), whatever the reservation's status", () => asCompany(async () => {
        const seeded = await seedMay();

        const response = await list(manager, {kind: "reservation_deposit"});

        expect(response.status).toBe(200);
        const rows: PaymentsHubRow[] = response.body.data;
        expect(rows).toHaveLength(2);
        expect(rows.find((row) => row.reservationId === seeded.paidDeposit.toString())).toMatchObject({
            _id: `reservation:${seeded.paidDeposit}`, status: "paid", dueDate: "2026-05-15", paidDate: "2026-05-15",
            amount: 300, paidAmount: 300, remaining: 0, client: expect.objectContaining({name: "Ana"}),
        });
        expect(rows.map((row) => row.paidDate).sort()).toEqual(["2026-01-10", "2026-05-15"]);
        expect(rows.every((row) => row.reservationCode?.startsWith("RES-"))).toBe(true);
    }));

    it("keeps the sale and plan filters: a sale filter keeps that cash sale only, a plan filter only the plan's rows", () => asCompany(async () => {
        const seeded = await seedMay();

        const bySale = await list(manager, {sale: seeded.approvedCash.toString()});
        const byPlan = await list(manager, {plan: seeded.planId.toString()});

        expect((bySale.body.data as PaymentsHubRow[]).map((row) => row._id)).toEqual([`sale:${seeded.approvedCash}`]);
        expect((byPlan.body.data as PaymentsHubRow[]).map((row) => row.kind).sort()).toEqual(["down_payment", "installment", "installment"]);
    }));

    it("gives a caller who may not read reservations no deposit rows, and no error", () => asCompany(async () => {
        await seedMay();

        const response = await list(withoutReservations, {});

        expect(response.status).toBe(200);
        const kinds = new Set((response.body.data as PaymentsHubRow[]).map((row) => row.kind));
        expect(kinds.has("reservation_deposit")).toBe(false);
        expect(kinds.has("cash_sale")).toBe(true);
    }));

    it("counts what was paid on a cancelled plan in paid totals and in collected this month, never as owed", () => asCompany(async () => {
        vi.useFakeTimers({toFake: ["Date"], now: new Date("2026-05-25T10:00:00.000Z")});
        const seeded = await seedMay();

        const plan = await list(manager, {plan: seeded.planId.toString()});
        const summary = await request(app)
            .post("/api/realEstate/paymentsHub/payments/summary")
            .set(callerHeader(manager))
            .send({plan: seeded.planId.toString()});

        const installment = (plan.body.data as PaymentsHubRow[]).find((row) => row.installmentNumber === 1);
        expect(installment).toMatchObject({status: "cancelled", paidAmount: 400});
        // 100 down payment + 400 received on the cancelled installment; nothing on the cancelled plan is owed.
        expect(values(plan.body.totals.paidAmount)).toEqual([[seeded.chf.toString(), 500]]);
        expect(plan.body.totals.outstandingAmount).toEqual([]);
        expect(values(summary.body.kpis.collectedThisMonthAmount)).toEqual([[seeded.chf.toString(), 500]]);
        expect(summary.body.kpis.overdueAmount).toEqual([]);
    }));

    it("adds up to the dashboard's Collected for the same period and edifice, filtered as its link filters", () => asCompany(async () => {
        const seeded = await seedMay();
        const edifice = seeded.edifice.toString();

        const hub = await list(manager, {dateField: "paidDate", ...MAY, edifice});
        const dashboard = await request(app)
            .post("/api/realEstate/dashboard")
            .set(callerHeader(manager))
            .send({from: MAY.dateFrom, to: MAY.dateTo, edificeId: edifice});

        expect(hub.status).toBe(200);
        expect(dashboard.status).toBe(200);
        // 1000.50 + 200 cash, 300 deposit, 100 down payment, 400 on the installment; the rejected 5000 is in neither.
        const expected = [[seeded.chf.toString(), 2000.5]];
        expect(values(hub.body.totals.paidAmount)).toEqual(expected);
        expect(values(dashboard.body.summary.collected)).toEqual(expected);
        expect((hub.body.data as PaymentsHubRow[]).some((row) => row.saleId === seeded.rejectedCash.toString())).toBe(false);
    }));
});

describe("payments hub and Collected agree on the edge cases (TD-B182, TD-B183)", {timeout: 60000}, () => {
    const collected = async (caller: TestCaller, body: Record<string, unknown>) => {
        const response = await request(app).post("/api/realEstate/dashboard").set(callerHeader(caller)).send(body);
        expect(response.status).toBe(200);
        return values(response.body.summary.collected);
    };

    it("leaves out a plan whose sale was deleted, as Collected does", () => asCompany(async () => {
        const seeded = await seedMay();
        await db().collection("sales").updateOne({_id: seeded.planSale}, {$set: {deletedAt: new Date()}});
        // Not an administrator: an administrator sees deleted records everywhere, by design.
        const staff: TestCaller = {...manager, isAdmin: false};
        const edifice = seeded.edifice.toString();

        const hub = await list(staff, {dateField: "paidDate", ...MAY, edifice});

        expect(hub.status).toBe(200);
        expect((hub.body.data as PaymentsHubRow[]).some((row) => row.planId === seeded.planId.toString())).toBe(false);
        // 1000.50 + 200 cash and the 300 deposit; the deleted sale's 500 of plan payments in neither.
        expect(values(hub.body.totals.paidAmount)).toEqual([[seeded.chf.toString(), 1500.5]]);
        expect(await collected(staff, {from: MAY.dateFrom, to: MAY.dateTo, edificeId: edifice})).toEqual([[seeded.chf.toString(), 1500.5]]);
    }));

    it("without a period, keeps money received on a row that records no paid day", () => asCompany(async () => {
        const seeded = await seedMay();
        await db().collection("paymentplans").updateOne({_id: seeded.planId}, {$unset: {"installments.0.paidDate": ""}});
        const edifice = seeded.edifice.toString();

        const hub = await list(manager, {dateField: "paidDate", edifice});

        expect(hub.status).toBe(200);
        expect((hub.body.data as PaymentsHubRow[]).some((row) => row.planId === seeded.planId.toString() && row.installmentNumber === 1)).toBe(true);
        expect(values(hub.body.totals.paidAmount)).toEqual(await collected(manager, {edificeId: edifice}));
    }));

    it("queries a money field against null without failing", () => asCompany(async () => {
        await seedMay();
        await expect(Reservation.find({depositAmount: {$ne: null}}).lean()).resolves.toHaveLength(3);
        await expect(Sale.find({finalPrice: null}).lean()).resolves.toHaveLength(0);
    }));
});
