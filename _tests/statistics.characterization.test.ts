/**
 * Characterization of the two giant statistics functions (TD-B137, OPT-03): the dashboard's `getDashboardStats` and
 * `unitService.calculateStatistics`. Pinned on seeded data before they were split into per-block functions, so the
 * split is proven to return exactly what the single functions returned.
 *
 * Re-pinned on 2026-11-10 when the money became exact and per currency (TD-B165, TD-B166, GLB-08). What changed:
 * - U-plan's payment plan (EUR, down payment 50000.00 paid, installments 100000.00 paid / 100000.00 with 25000.55 paid
 *   / 50000.00 open): "collected" was 1 (the paid flag `true` read as a number, plus an installment total that was read
 *   before it existed, so 0) and is now 175000.55 (50000.00 + 100000.00 + 25000.55); "not collected" was 174998.45
 *   (the down payment less that 1, plus the open installments) and is now 124999.45 (300000.00 owed − 175000.55 paid).
 * - Unit-cost sums are Decimal128: 3 × 100.10 + 0.05 is 300.35, not 300.34999999999997.
 * - The dashboard no longer adds amounts in two currencies: inventory value (369999.99 = CHF 249999.99 + EUR 120000),
 *   reservation deposits (8000.5 = CHF 5000 + EUR 3000.50), plan outstanding, the average sale price (250000.05 across
 *   CHF and EUR) and each month's revenue are now one row per currency.
 * - A price per m² is a price, rounded once at the currency: U-cash's 200000.10 / 100 m² is 2000.00, not 2000.001.
 * - Statistics currencies carry `decimalPlaces` when the currency has it, so a rollup rounds at the right precision.
 * - Payment alerts carry their currency (TD-B171). Having a `currency`, they are now sorted like money rows below, so
 *   their order in the snapshot changed; the alerts themselves did not.
 *
 * Re-pinned on 2026-11-10 (TD-B176): the summary has `collected` (money received: CHF 200000.10 cash + 5000.00 paid
 * deposit, EUR 50000.00 down payment + 100000.00 + 25000.55 installment payments); the partly paid installment's alert
 * shows what is left (74999.45, not 100000.00); dashboard money rows carry `currencyDecimalPlaces`.
 *
 * Re-pinned on 2026-11-18: recent sales carry their `buyer` (the list names the buyer, not the staff seller) and the
 * sale currency's symbol, abbreviation and decimal places, so the price prints in its own currency (UX-07).
 */
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as dashboardRoute from "@propertyManagement/api/realEstate/private/dashboard";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import Project from "@propertyManagement/database/schemas/project/project";
import Edifice from "@propertyManagement/database/schemas/edifice/edifice";
import Floor from "@propertyManagement/database/schemas/floor/floor";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, dec, seedCompany, seedLease, seedRentRow} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([{...dashboardRoute, module: "propertyManagement"}]);
const db = () => mongoose.connection.db!;

/** Seeded ids, replaced by their names in the output so the pinned values do not depend on random ids. */
const labels = new Map<string, string>();
const id = (label: string) => {
    const value = new ObjectId();
    labels.set(value.toString(), label);
    return value;
};
/** Money rows come out of `$group` in no fixed order: sorted, so only their content is pinned. */
const sortMoneyRows = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        const items = value.map(sortMoneyRows);
        const moneyRows = items.every((item) => item && typeof item === "object" && ("currencyId" in item || "currency" in item));
        return moneyRows ? items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : items;
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sortMoneyRows(entry)]));
    }
    return value;
};
const stable = (value: unknown): unknown =>
    sortMoneyRows(JSON.parse(JSON.stringify(value).replace(/[0-9a-f]{24}/g, (hex) => labels.get(hex) ?? "<other>")));

let manager: TestCaller;
const units: Record<string, ObjectId> = {};

beforeAll(async () => {
    // Every day the statistics read is a local `YYYY-MM-DD` day against the company's today (D115): pin today.
    vi.useFakeTimers({toFake: ["Date"], now: new Date("2026-06-15T10:00:00Z")});
    await connectTestDatabase();
    manager = {
        userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true,
        permissions: allPermissionTags([Unit, Sale, PaymentPlan, Reservation, UnitCost, RentalPayment, Lease, Inspection, ModificationRequest, Project, Edifice, Floor]),
    };
    await asCompany(seed);
}, 120000);

afterAll(async () => {
    vi.useRealTimers();
    await disconnectTestDatabase();
});

async function seed(): Promise<void> {
    await seedCompany(companyId, "Europe/Zurich");
    const chf = id("CHF");
    const eur = id("EUR");
    for (const [_id, abbreviation] of [[chf, "CHF"], [eur, "EUR"]] as const) {
        await db().collection("currencies").insertOne({_id, name: abbreviation, symbol: abbreviation, abbreviation, decimalPlaces: 2, company: companyId, deletedAt: null});
    }
    const agent = id("agent");
    const buyer = id("buyer");
    for (const [_id, name] of [[agent, "Agent"], [buyer, "Buyer"]] as const) {
        await db().collection("users").insertOne({_id, name, surname: "Test", username: `${name}@example.com`, roles: [{company: companyId, roles: []}], deletedAt: null});
    }
    const project = id("project");
    const edifice = id("edifice");
    const floor = id("floor");
    await db().collection("projects").insertOne({_id: project, company: companyId, name: "Riverside", deletedAt: null});
    await db().collection("edifices").insertOne({_id: edifice, company: companyId, project, name: "Block A", deletedAt: null});
    await db().collection("floors").insertOne({_id: floor, company: companyId, edifice, project, name: "Floor 1", deletedAt: null});

    const unit = async (label: string, input: {status: string; price: string; currency: ObjectId; area?: number; verandaArea?: number}) => {
        const _id = id(label);
        units[label] = _id;
        await db().collection("units").insertOne({
            _id, company: companyId, project, edifice, floor, unitType: new ObjectId(), unitNumber: label, name: `Unit ${label}`,
            area: input.area ?? 80, verandaArea: input.verandaArea, netArea: 70, price: dec(input.price), priceCurrency: input.currency,
            status: input.status, deletedAt: null, createdAt: new Date("2026-01-01T00:00:00Z"),
        });
        return _id;
    };
    const cashUnit = await unit("U-cash", {status: UnitStatus.SOLD, price: "200000.10", currency: chf, verandaArea: 20});
    const planUnit = await unit("U-plan", {status: UnitStatus.SOLD, price: "300000.00", currency: eur});
    const reservedPaid = await unit("U-res-paid", {status: UnitStatus.RESERVED, price: "150000.00", currency: chf});
    const reservedUnpaid = await unit("U-res-unpaid", {status: UnitStatus.RESERVED, price: "120000.00", currency: eur});
    const rented = await unit("U-rented", {status: UnitStatus.RENTED, price: "90000.00", currency: chf});
    await unit("U-free", {status: UnitStatus.AVAILABLE, price: "99999.99", currency: chf, area: 0});

    const cashSale = id("sale-cash");
    const planSale = id("sale-plan");
    const plan = id("plan");
    await db().collection("sales").insertMany([
        {_id: cashSale, company: companyId, name: "SALE-CASH", unit: cashUnit, buyer, soldBy: agent, saleCurrency: chf, paymentType: "cash",
            finalPrice: dec("200000.10"), saleDate: "2026-05-02", createdAt: new Date("2026-05-02T09:00:00Z"), deletedAt: null},
        {_id: planSale, company: companyId, name: "SALE-PLAN", unit: planUnit, buyer, soldBy: agent, saleCurrency: eur, paymentType: "payment_plan",
            paymentPlan: plan, finalPrice: dec("300000.00"), saleDate: "2026-03-20", createdAt: new Date("2026-03-20T09:00:00Z"), deletedAt: null},
    ]);
    await db().collection("paymentplans").insertOne({
        _id: plan, company: companyId, name: "PLAN-1", sale: planSale, status: "active",
        totalAmount: dec("300000.00"), downPayment: dec("50000.00"), downPaymentPaid: true, remainingBalance: dec("200000.00"),
        numberOfInstallments: 3, installmentAmount: dec("250000.00"), startDate: "2026-03-20", endDate: "2026-09-20",
        installments: [
            {installmentNumber: 1, dueDate: "2026-05-20", amount: dec("100000.00"), principalAmount: dec("100000.00"), interestAmount: dec("0"), status: "paid", paidAmount: dec("100000.00"), paidDate: "2026-05-19"},
            {installmentNumber: 2, dueDate: "2026-06-20", amount: dec("100000.00"), principalAmount: dec("100000.00"), interestAmount: dec("0"), status: "partially_paid", paidAmount: dec("25000.55")},
            {installmentNumber: 3, dueDate: "2026-06-01", amount: dec("50000.00"), principalAmount: dec("50000.00"), interestAmount: dec("0"), status: "overdue"},
        ],
        deletedAt: null,
    });

    await db().collection("reservations").insertMany([
        {_id: id("res-paid"), company: companyId, unit: reservedPaid, client: buyer, reservedBy: agent, reservedByCompany: companyId, name: "RES-PAID",
            reservationDate: "2026-06-01", expirationDate: "2026-06-18", depositAmount: dec("5000.00"), depositCurrency: chf, paid: true, isActive: true, status: "active",
            createdAt: new Date("2026-06-01T09:00:00Z"), deletedAt: null},
        {_id: id("res-unpaid"), company: companyId, unit: reservedUnpaid, client: buyer, reservedBy: agent, reservedByCompany: companyId, name: "RES-UNPAID",
            reservationDate: "2026-06-05", expirationDate: "2026-06-25", depositAmount: dec("3000.50"), depositCurrency: eur, paid: false, isActive: true, status: "active",
            createdAt: new Date("2026-06-05T09:00:00Z"), deletedAt: null},
    ]);

    const cost = (label: string, unitId: ObjectId, currency: ObjectId, verificationStatus: string, paymentStatus: string, items: [number, string][]) => ({
        _id: id(label), company: companyId, unit: unitId, project, currency, name: label, purchaseDate: "2026-04-01", verificationStatus, paymentStatus,
        expenditureItems: items.map(([amount, pricePerUnit]) => ({title: "Item", category: "material", amount, unit: "pcs", pricePerUnit: dec(pricePerUnit)})),
        deletedAt: null,
    });
    await db().collection("unitcosts").insertMany([
        cost("cost-paid", cashUnit, chf, "verified", "paid", [[3, "100.10"], [1, "0.05"]]),
        cost("cost-open", cashUnit, chf, "verified", "unpaid", [[2, "2500.25"]]),
        cost("cost-pending", planUnit, eur, "pending_verification", "unpaid", [[1, "999.99"]]),
    ]);

    const lease = await seedLease(companyId, {unit: rented, tenant: buyer, currency: chf, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "1200.00"});
    labels.set(lease.toString(), "lease");
    for (const [label, row] of [
        ["rent-paid", {dueDate: "2026-05-01", amount: "1200.00", status: "paid", paidAmount: "1200.00"}],
        ["rent-overdue", {dueDate: "2026-06-01", amount: "1200.00", status: "overdue", paidAmount: "200.00"}],
        ["rent-waived", {dueDate: "2026-04-01", amount: "1200.00", status: "waived"}],
        ["rent-due", {dueDate: "2026-07-01", amount: "1200.00", status: "pending"}],
    ] as const) {
        labels.set((await seedRentRow(companyId, {lease, unit: rented, currency: chf, ...row})).toString(), label);
    }

    await db().collection("inspections").insertMany([
        {_id: id("insp-1"), name: "INSP-1", company: companyId, unit: cashUnit, status: "completed", followUpRequired: true, deletedAt: null},
        {_id: id("insp-2"), name: "INSP-2", company: companyId, unit: planUnit, status: "scheduled", followUpRequired: false, deletedAt: null},
    ]);
    await db().collection("modificationrequests").insertMany([
        {_id: id("mod-1"), name: "MOD-1", company: companyId, unit: planUnit, status: "pending", deletedAt: null},
        {_id: id("mod-2"), name: "MOD-2", company: companyId, unit: planUnit, status: "completed", deletedAt: null},
    ]);
}

describe("statistics characterization (TD-B137)", {timeout: 60000}, () => {
    it("getDashboardStats returns exact money, one row per currency", async () => {
        const res = await request(app).post("/api/realEstate/dashboard").set(callerHeader(manager)).send({period: "month", recentSalesLimit: 10});
        expect(res.status).toBe(200);
        expect(stable(res.body)).toMatchInlineSnapshot(`
          {
            "paymentAlerts": [
              {
                "client": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "currency": {
                  "_id": "EUR",
                  "abbreviation": "EUR",
                  "decimalPlaces": 2,
                  "name": "EUR",
                  "symbol": "EUR",
                },
                "daysUntilDue": -14,
                "installment": {
                  "amount": 50000,
                  "dueDate": "2026-06-01",
                },
                "kind": "installment",
                "saleId": "sale-plan",
                "unit": {
                  "_id": "U-plan",
                  "name": "Unit U-plan",
                  "unitNumber": "U-plan",
                },
              },
              {
                "client": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "currency": {
                  "_id": "EUR",
                  "abbreviation": "EUR",
                  "decimalPlaces": 2,
                  "name": "EUR",
                  "symbol": "EUR",
                },
                "daysUntilDue": 5,
                "installment": {
                  "amount": 74999.45,
                  "dueDate": "2026-06-20",
                },
                "kind": "installment",
                "saleId": "sale-plan",
                "unit": {
                  "_id": "U-plan",
                  "name": "Unit U-plan",
                  "unitNumber": "U-plan",
                },
              },
              {
                "client": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "currency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "daysUntilDue": -14,
                "installment": {
                  "amount": 1000,
                  "dueDate": "2026-06-01",
                },
                "kind": "rent",
                "rentalPaymentId": "rent-overdue",
                "unit": {
                  "_id": "U-rented",
                  "name": "Unit U-rented",
                  "unitNumber": "U-rented",
                },
              },
              {
                "client": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "currency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "daysUntilDue": 16,
                "installment": {
                  "amount": 1200,
                  "dueDate": "2026-07-01",
                },
                "kind": "rent",
                "rentalPaymentId": "rent-due",
                "unit": {
                  "_id": "U-rented",
                  "name": "Unit U-rented",
                  "unitNumber": "U-rented",
                },
              },
              {
                "client": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "currency": {
                  "_id": "EUR",
                  "abbreviation": "EUR",
                  "decimalPlaces": 2,
                  "name": "EUR",
                  "symbol": "EUR",
                },
                "daysUntilDue": 10,
                "installment": {
                  "amount": 3000.5,
                  "dueDate": "2026-06-25",
                },
                "kind": "reservation",
                "reservationId": "res-unpaid",
                "unit": {
                  "_id": "U-res-unpaid",
                  "name": "Unit U-res-unpaid",
                  "unitNumber": "U-res-unpaid",
                },
              },
            ],
            "recentSales": [
              {
                "_id": "sale-cash",
                "buyer": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "finalPrice": 200000.1,
                "paymentType": "cash",
                "saleCurrency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "saleDate": "2026-05-02",
                "soldBy": {
                  "_id": "agent",
                  "name": "Agent",
                  "surname": "Test",
                },
                "unit": {
                  "_id": "U-cash",
                  "name": "Unit U-cash",
                  "unitNumber": "U-cash",
                },
              },
              {
                "_id": "sale-plan",
                "buyer": {
                  "_id": "buyer",
                  "name": "Buyer",
                  "surname": "Test",
                },
                "finalPrice": 300000,
                "paymentType": "payment_plan",
                "saleCurrency": {
                  "_id": "EUR",
                  "abbreviation": "EUR",
                  "decimalPlaces": 2,
                  "name": "EUR",
                  "symbol": "EUR",
                },
                "saleDate": "2026-03-20",
                "soldBy": {
                  "_id": "agent",
                  "name": "Agent",
                  "surname": "Test",
                },
                "unit": {
                  "_id": "U-plan",
                  "name": "Unit U-plan",
                  "unitNumber": "U-plan",
                },
              },
            ],
            "revenueByPeriod": [
              {
                "month": "2026-03",
                "revenue": [
                  {
                    "currencyDecimalPlaces": 2,
                    "currencyId": "EUR",
                    "currencyName": "EUR",
                    "currencySymbol": "EUR",
                    "value": 300000,
                  },
                ],
              },
              {
                "month": "2026-05",
                "revenue": [
                  {
                    "currencyDecimalPlaces": 2,
                    "currencyId": "CHF",
                    "currencyName": "CHF",
                    "currencySymbol": "CHF",
                    "value": 200000.1,
                  },
                ],
              },
            ],
            "salesByPeriod": [
              {
                "count": 1,
                "month": "2026-03",
              },
              {
                "count": 1,
                "month": "2026-05",
              },
            ],
            "summary": {
              "activeReservations": 2,
              "averageSalePrice": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 200000.1,
                },
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "EUR",
                  "currencyName": "EUR",
                  "currencySymbol": "EUR",
                  "value": 300000,
                },
              ],
              "collected": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 205000.1,
                },
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "EUR",
                  "currencyName": "EUR",
                  "currencySymbol": "EUR",
                  "value": 175000.55,
                },
              ],
              "expiringReservationsCount": 1,
              "inspections": {
                "byStatus": {
                  "completed": 1,
                  "scheduled": 1,
                },
                "followUpRequiredCount": 1,
              },
              "inventoryValue": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 249999.99,
                },
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "EUR",
                  "currencyName": "EUR",
                  "currencySymbol": "EUR",
                  "value": 120000,
                },
              ],
              "modificationRequests": {
                "byStatus": {
                  "completed": 1,
                  "pending": 1,
                },
              },
              "occupancyRatePercent": 33.33333333333333,
              "openModificationRequests": 1,
              "paymentPlans": {
                "byStatus": {
                  "active": 1,
                  "cancelled": 0,
                  "completed": 0,
                  "defaulted": 0,
                },
                "overdueInstallmentsCount": 1,
                "totalOutstanding": [
                  {
                    "currencyDecimalPlaces": 2,
                    "currencyId": "EUR",
                    "currencyName": "EUR",
                    "currencySymbol": "EUR",
                    "value": 200000,
                  },
                ],
              },
              "paymentPlansCompleted": 0,
              "paymentPlansDefaulted": 0,
              "pendingVerificationUnitCosts": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "EUR",
                  "currencyName": "EUR",
                  "currencySymbol": "EUR",
                  "value": 999.99,
                },
              ],
              "rentals": {
                "activeLeases": 1,
                "collectedAmount": [
                  {
                    "currencyDecimalPlaces": 2,
                    "currencyId": "CHF",
                    "currencyName": "CHF",
                    "currencySymbol": "CHF",
                    "value": 1400,
                  },
                ],
                "outstandingAmount": [
                  {
                    "currencyDecimalPlaces": 2,
                    "currencyId": "CHF",
                    "currencyName": "CHF",
                    "currencySymbol": "CHF",
                    "value": 2200,
                  },
                ],
                "overdueAmount": [
                  {
                    "currencyDecimalPlaces": 2,
                    "currencyId": "CHF",
                    "currencyName": "CHF",
                    "currencySymbol": "CHF",
                    "value": 1000,
                  },
                ],
                "overdueCount": 1,
              },
              "salesByPaymentType": {
                "cash": 1,
                "payment_plan": 1,
              },
              "totalEdifices": 1,
              "totalFloors": 1,
              "totalInspections": 2,
              "totalProjects": 1,
              "totalReservationDeposits": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 5000,
                },
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "EUR",
                  "currencyName": "EUR",
                  "currencySymbol": "EUR",
                  "value": 3000.5,
                },
              ],
              "totalRevenue": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 200000.1,
                },
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "EUR",
                  "currencyName": "EUR",
                  "currencySymbol": "EUR",
                  "value": 300000,
                },
              ],
              "totalSales": 2,
              "totalUnitCostDocuments": 3,
              "totalUnits": 6,
              "unitsByStatus": {
                "available": 1,
                "leased": 1,
                "reserved": 2,
                "sold": 2,
                "unavailable": 0,
              },
              "verifiedOutstandingUnitCosts": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 5000.5,
                },
              ],
              "verifiedPaidUnitCosts": [
                {
                  "currencyDecimalPlaces": 2,
                  "currencyId": "CHF",
                  "currencyName": "CHF",
                  "currencySymbol": "CHF",
                  "value": 300.35,
                },
              ],
            },
          }
        `);
    });

    it("collected is the money received in the period, and needs sales, plans and reservations read (TD-B176)", async () => {
        const collected = async (caller: TestCaller, body: Record<string, unknown>) => {
            const res = await request(app).post("/api/realEstate/dashboard").set(callerHeader(caller)).send(body);
            expect(res.status).toBe(200);
            return (stable(res.body) as {summary: {collected: {currencyId: string; value: number}[]}}).summary.collected
                .map(({currencyId, value}) => [currencyId, value]);
        };
        // May: the cash sale (2 May) and the first installment (paid 19 May). The down payment and the second
        // installment have no paid day and the deposit was taken on 1 June, so they fall outside any period.
        expect(await collected(manager, {from: "2026-05-01", to: "2026-05-31"})).toEqual([["CHF", 200000.1], ["EUR", 100000]]);
        expect(await collected(manager, {from: "2026-06-01", to: "2026-06-30"})).toEqual([["CHF", 5000]]);
        const withoutReservations: TestCaller = {
            ...manager,
            permissions: allPermissionTags([Unit, Sale, PaymentPlan, UnitCost, RentalPayment, Lease, Inspection, ModificationRequest, Project, Edifice, Floor]),
        };
        expect(await collected(withoutReservations, {from: "2026-05-01", to: "2026-05-31"})).toEqual([]);
    });

    it("recent sales leave the buyer out for a caller who may not read it (SEC-09)", async () => {
        const recentSales = async (caller: TestCaller) => {
            const res = await request(app).post("/api/realEstate/dashboard").set(callerHeader(caller)).send({period: "month", recentSalesLimit: 10});
            expect(res.status).toBe(200);
            return res.body.recentSales as {buyer?: unknown}[];
        };
        expect((await recentSales(manager)).some((sale) => sale.buyer)).toBe(true);
        // The second call is served from the company's cache, which still holds the buyer.
        const withoutBuyer: TestCaller = {
            ...manager,
            permissions: manager.permissions.filter((tag) => !(tag.startsWith("sales[") && tag.includes("buyer"))),
        };
        const sales = await recentSales(withoutBuyer);
        expect(sales.length).toBeGreaterThan(0);
        expect(sales.every((sale) => sale.buyer === undefined)).toBe(true);
    });

    it("unitService.calculateStatistics returns exact money, a plan's collected from its payments", async () => {
        const {logger} = actor(companyId);
        const actionUserCtx = {...actor(companyId, manager.permissions).actionUserCtx};
        const stats = await asCompany(() => unitService.calculateStatistics(Object.values(units), actionUserCtx, "en-US", {logger}));
        expect(stable(stats)).toMatchInlineSnapshot(`
          {
            "U-cash": {
              "averagePricePerSquareMeter": {
                "currency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "value": 2000,
              },
              "collectedAmount": [
                {
                  "currency": {
                    "_id": "CHF",
                    "abbreviation": "CHF",
                    "decimalPlaces": 2,
                    "name": "CHF",
                    "symbol": "CHF",
                  },
                  "value": 200000.1,
                },
              ],
              "notCollectedAmount": [],
              "unitCostDocumentCount": 2,
              "verifiedOutstandingUnitCosts": [
                {
                  "currency": {
                    "_id": "CHF",
                    "abbreviation": "CHF",
                    "decimalPlaces": 2,
                    "name": "CHF",
                    "symbol": "CHF",
                  },
                  "value": 5000.5,
                },
              ],
              "verifiedPaidUnitCosts": [
                {
                  "currency": {
                    "_id": "CHF",
                    "abbreviation": "CHF",
                    "decimalPlaces": 2,
                    "name": "CHF",
                    "symbol": "CHF",
                  },
                  "value": 300.35,
                },
              ],
            },
            "U-free": {
              "averagePricePerSquareMeter": {
                "currency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "value": 0,
              },
              "notCollectedAmount": [],
              "unitCostDocumentCount": 0,
            },
            "U-plan": {
              "averagePricePerSquareMeter": {
                "currency": {
                  "_id": "EUR",
                  "abbreviation": "EUR",
                  "decimalPlaces": 2,
                  "name": "EUR",
                  "symbol": "EUR",
                },
                "value": 3750,
              },
              "collectedAmount": [
                {
                  "currency": {
                    "_id": "EUR",
                    "abbreviation": "EUR",
                    "decimalPlaces": 2,
                    "name": "EUR",
                    "symbol": "EUR",
                  },
                  "value": 175000.55,
                },
              ],
              "notCollectedAmount": [
                {
                  "currency": {
                    "_id": "EUR",
                    "abbreviation": "EUR",
                    "decimalPlaces": 2,
                    "name": "EUR",
                    "symbol": "EUR",
                  },
                  "value": 124999.45,
                },
              ],
              "pendingVerificationUnitCosts": [
                {
                  "currency": {
                    "_id": "EUR",
                    "abbreviation": "EUR",
                    "decimalPlaces": 2,
                    "name": "EUR",
                    "symbol": "EUR",
                  },
                  "value": 999.99,
                },
              ],
              "unitCostDocumentCount": 1,
            },
            "U-rented": {
              "averagePricePerSquareMeter": {
                "currency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "value": 1125,
              },
              "notCollectedAmount": [],
              "unitCostDocumentCount": 0,
            },
            "U-res-paid": {
              "averagePricePerSquareMeter": {
                "currency": {
                  "_id": "CHF",
                  "abbreviation": "CHF",
                  "decimalPlaces": 2,
                  "name": "CHF",
                  "symbol": "CHF",
                },
                "value": 1875,
              },
              "collectedAmount": [
                {
                  "currency": {
                    "_id": "CHF",
                    "abbreviation": "CHF",
                    "decimalPlaces": 2,
                    "name": "CHF",
                    "symbol": "CHF",
                  },
                  "value": 5000,
                },
              ],
              "notCollectedAmount": [],
              "unitCostDocumentCount": 0,
            },
            "U-res-unpaid": {
              "averagePricePerSquareMeter": {
                "currency": {
                  "_id": "EUR",
                  "abbreviation": "EUR",
                  "decimalPlaces": 2,
                  "name": "EUR",
                  "symbol": "EUR",
                },
                "value": 1500,
              },
              "notCollectedAmount": [
                {
                  "currency": {
                    "_id": "EUR",
                    "abbreviation": "EUR",
                    "decimalPlaces": 2,
                    "name": "EUR",
                    "symbol": "EUR",
                  },
                  "value": 3000.5,
                },
              ],
              "unitCostDocumentCount": 0,
            },
          }
        `);
    });
});
