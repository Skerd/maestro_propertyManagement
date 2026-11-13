/**
 * TD-B223: the ROI never adds, subtracts or compares amounts across currencies. Each currency gets its own revenue,
 * costs and net profit, and a unit's net profit needs its costs in the sale's currency.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as roiRoute from "@propertyManagement/api/realEstate/private/roi";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import {roiTotalsByCurrency, unitGrossYield, unitNetProfit} from "@propertyManagement/utilities/roi/roiCurrencyTotals";
import {asTenant, clearDatabase, dec, seedCurrency, seedUnit} from "./sale.fixtures";

const eur = (amount: number) => ({currencyId: "eur", amount, decimals: 2, currencySymbol: "€"});
const chf = (amount: number) => ({currencyId: "chf", amount, decimals: 2, currencySymbol: "CHF"});
const kwd = (amount: number) => ({currencyId: "kwd", amount, decimals: 3, currencySymbol: "KD"});

describe("a unit's net profit", () => {
    it("subtracts costs in the sale's currency", () => {
        expect(unitNetProfit(eur(1000), [eur(250.1), eur(149.9)])).toEqual({netProfit: {amount: 600, decimals: 2}, roiPercent: 150});
        expect(unitNetProfit(kwd(10.005), [kwd(5.001)])).toEqual({netProfit: {amount: 5.004, decimals: 3}, roiPercent: expect.closeTo(100.06, 2)});
    });

    it("keeps the full price without costs, with no ROI", () => {
        expect(unitNetProfit(eur(1000), [])).toEqual({netProfit: {amount: 1000, decimals: 2}, roiPercent: undefined});
    });

    it("is left out when a cost is in another currency or nothing was sold", () => {
        expect(unitNetProfit(eur(1000), [eur(100), chf(50)])).toEqual({});
        expect(unitNetProfit(eur(1000), [chf(50)])).toEqual({});
        expect(unitNetProfit(undefined, [eur(100)])).toEqual({});
    });
});

describe("a unit's gross yield (TD-B227)", () => {
    it("is a year of rent over the sale price when both are in one currency", () => {
        expect(unitGrossYield(eur(200000), {currencyId: "eur", amount: 1000})).toBe(6);
    });

    it("is left out across currencies, without a rent or a sale, or for a free sale", () => {
        expect(unitGrossYield(eur(200000), {currencyId: "chf", amount: 1000})).toBeUndefined();
        expect(unitGrossYield(eur(200000), undefined)).toBeUndefined();
        expect(unitGrossYield(eur(200000), {currencyId: "eur", amount: 0})).toBeUndefined();
        expect(unitGrossYield(undefined, {currencyId: "eur", amount: 1000})).toBeUndefined();
        expect(unitGrossYield(eur(0), {currencyId: "eur", amount: 1000})).toBeUndefined();
    });
});

describe("the scope totals per currency", () => {
    it("sums revenue and costs within each currency and orders the currencies by symbol", () => {
        const totals = roiTotalsByCurrency([
            {sale: eur(1000), costs: [eur(200)]},
            {sale: chf(500), costs: [eur(50), chf(600)]},
            {costs: [kwd(1.001)]},
            {costs: []},
        ]);
        expect(totals).toEqual([
            {currencySymbol: "CHF", decimals: 2, totalRevenue: 500, totalCosts: 600, netProfit: -100, roiPercent: expect.closeTo(-16.67, 2)},
            {currencySymbol: "KD", decimals: 3, totalRevenue: 0, totalCosts: 1.001, netProfit: -1.001, roiPercent: -100},
            {currencySymbol: "€", decimals: 2, totalRevenue: 1000, totalCosts: 250, netProfit: 750, roiPercent: 300},
        ]);
    });

    it("is one entry for a single currency and none without sales or costs", () => {
        expect(roiTotalsByCurrency([{sale: eur(10), costs: []}])).toEqual([
            {currencySymbol: "€", decimals: 2, totalRevenue: 10, totalCosts: 0, netProfit: 10, roiPercent: 0},
        ]);
        expect(roiTotalsByCurrency([{costs: []}])).toEqual([]);
    });
});

describe("POST /api/realEstate/roi", {timeout: 60000}, () => {
    const companyId = new ObjectId();
    const asCompany = asTenant(companyId);
    const app = appFor([{...roiRoute, module: "propertyManagement"}]);
    const db = () => mongoose.connection.db!;
    let manager: TestCaller;

    beforeAll(async () => {
        await connectTestDatabase();
        manager = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions: allPermissionTags([Unit, UnitCost, Sale, Lease])};
    }, 120000);

    afterAll(async () => {
        await disconnectTestDatabase();
    });

    beforeEach(() => asCompany(clearDatabase));

    async function seedSale(unit: ObjectId, finalPrice: string, saleCurrency: ObjectId): Promise<void> {
        await db().collection("sales").insertOne({_id: new ObjectId(), company: companyId, unit, finalPrice: dec(finalPrice), saleCurrency, deletedAt: null});
    }

    async function seedCost(unit: ObjectId, currency: ObjectId, pricePerUnit: string, amount = 1): Promise<void> {
        await db().collection("unitcosts").insertOne({
            _id: new ObjectId(), name: `COST-${new ObjectId()}`, company: companyId, unit, currency, deletedAt: null,
            expenditureItems: [{title: "Works", category: "construction", unit: "pcs", amount, pricePerUnit: dec(pricePerUnit)}],
        });
    }

    async function seedActiveLease(unit: ObjectId, monthlyRent: string, rentCurrency: ObjectId): Promise<void> {
        await db().collection("leases").insertOne({_id: new ObjectId(), company: companyId, unit, status: "active", monthlyRent: dec(monthlyRent), rentCurrency, deletedAt: null});
    }

    it("returns the rent with its currency and a yield only when the rent and the sale share a currency", () => asCompany(async () => {
        const euro = await seedCurrency(companyId, "EUR");
        const franc = await seedCurrency(companyId, "CHF");
        const project = new ObjectId();
        const sameCurrency = await seedUnit(companyId, {price: "200000.00", priceCurrency: euro});
        const mixed = await seedUnit(companyId, {price: "200000.00", priceCurrency: euro});
        await db().collection("units").updateMany({_id: {$in: [sameCurrency, mixed]}}, {$set: {project}});
        await seedSale(sameCurrency, "200000.00", euro);
        await seedActiveLease(sameCurrency, "1000.00", euro);
        await seedSale(mixed, "200000.00", euro);
        await seedActiveLease(mixed, "1000.00", franc);

        const response = await request(app).post("/api/realEstate/roi").set(callerHeader(manager)).send({projectId: project.toString()});
        expect(response.status).toBe(200);

        const byUnit = new Map(response.body.units.map((unit: {unitId: string}) => [unit.unitId, unit]));
        expect(byUnit.get(sameCurrency.toString())).toMatchObject({monthlyRent: {amount: 1000, decimals: 2, currencySymbol: "EUR"}, annualGrossYield: 6});
        const mixedRow = byUnit.get(mixed.toString()) as {annualGrossYield?: number};
        expect(mixedRow).toMatchObject({monthlyRent: {amount: 1000, decimals: 2, currencySymbol: "CHF"}});
        expect(mixedRow.annualGrossYield).toBeUndefined();
    }));

    it("returns the sale price, net profit and rent at a 0- and a 3-decimal currency's precision (TD-F103)", () => asCompany(async () => {
        const yen = await seedCurrency(companyId, "JPY", 0);
        const dinar = await seedCurrency(companyId, "KWD", 3);
        const project = new ObjectId();
        const inYen = await seedUnit(companyId, {price: "30000000", priceCurrency: yen});
        const inDinar = await seedUnit(companyId, {price: "90000.000", priceCurrency: dinar});
        await db().collection("units").updateMany({_id: {$in: [inYen, inDinar]}}, {$set: {project}});
        await seedSale(inYen, "30000000", yen);
        await seedCost(inYen, yen, "1250000");
        await seedActiveLease(inYen, "120000", yen);
        await seedSale(inDinar, "90000.125", dinar);
        await seedCost(inDinar, dinar, "10000.250", 2);
        await seedActiveLease(inDinar, "450.375", dinar);

        const response = await request(app).post("/api/realEstate/roi").set(callerHeader(manager)).send({projectId: project.toString()});
        expect(response.status).toBe(200);

        const byUnit = new Map(response.body.units.map((unit: {unitId: string}) => [unit.unitId, unit]));
        expect(byUnit.get(inYen.toString())).toMatchObject({
            salePrice: {amount: 30000000, decimals: 0, currencySymbol: "JPY"},
            costs: [{amount: 1250000, decimals: 0}],
            netProfit: {amount: 28750000, decimals: 0, currencySymbol: "JPY"},
            monthlyRent: {amount: 120000, decimals: 0, currencySymbol: "JPY"},
        });
        expect(byUnit.get(inDinar.toString())).toMatchObject({
            salePrice: {amount: 90000.125, decimals: 3, currencySymbol: "KWD"},
            costs: [{amount: 20000.5, decimals: 3}],
            netProfit: {amount: 69999.625, decimals: 3, currencySymbol: "KWD"},
            monthlyRent: {amount: 450.375, decimals: 3, currencySymbol: "KWD"},
        });
    }));

    it("shows no symbol on the sale price and net profit when the caller may not read the sale's currency (TD-B231)", () => asCompany(async () => {
        const euro = await seedCurrency(companyId, "EUR");
        const franc = await seedCurrency(companyId, "CHF");
        const project = new ObjectId();
        // The unit is priced in francs but sold in euros: its symbol must not stand in for the sale's.
        const unit = await seedUnit(companyId, {price: "1000.00", priceCurrency: franc});
        await db().collection("units").updateOne({_id: unit}, {$set: {project}});
        await seedSale(unit, "1000.00", euro);
        await seedCost(unit, euro, "200.00");
        const hidden = "sales[read:saleCurrency]";
        expect(manager.permissions).toContain(hidden);
        const clerk: TestCaller = {...manager, permissions: manager.permissions.filter((tag) => tag !== hidden)};

        const response = await request(app).post("/api/realEstate/roi").set(callerHeader(clerk)).send({projectId: project.toString()});
        expect(response.status).toBe(200);

        const [row] = response.body.units as {salePrice: Record<string, unknown>; netProfit: Record<string, unknown>}[];
        expect(row.salePrice).toEqual({amount: 1000, decimals: 2});
        expect(row.netProfit).toEqual({amount: 800, decimals: 2});
    }));

    it("returns the units' costs and the scope totals per currency", () => asCompany(async () => {
        const euro = await seedCurrency(companyId, "EUR");
        const franc = await seedCurrency(companyId, "CHF");
        const project = new ObjectId();
        const sameCurrency = await seedUnit(companyId, {price: "1000.00", priceCurrency: euro});
        const mixed = await seedUnit(companyId, {price: "500.00", priceCurrency: franc});
        await db().collection("units").updateMany({_id: {$in: [sameCurrency, mixed]}}, {$set: {project}});
        await seedSale(sameCurrency, "1000.00", euro);
        await seedCost(sameCurrency, euro, "100.05", 2);
        await seedSale(mixed, "500.00", franc);
        await seedCost(mixed, franc, "120.00");
        await seedCost(mixed, euro, "30.00");

        const response = await request(app).post("/api/realEstate/roi").set(callerHeader(manager)).send({projectId: project.toString()});
        expect(response.status).toBe(200);

        const byUnit = new Map(response.body.units.map((unit: {unitId: string}) => [unit.unitId, unit]));
        expect(byUnit.get(sameCurrency.toString())).toMatchObject({
            salePrice: {amount: 1000, decimals: 2, currencySymbol: "EUR"},
            costs: [{amount: 200.1, decimals: 2}],
            netProfit: {amount: 799.9, decimals: 2, currencySymbol: "EUR"},
        });
        const mixedRow = byUnit.get(mixed.toString()) as {costs: {amount: number}[]; netProfit?: number; roiPercent?: number};
        expect(mixedRow.costs.map((cost) => cost.amount).sort((a, b) => a - b)).toEqual([30, 120]);
        expect(mixedRow.netProfit).toBeUndefined();
        expect(mixedRow.roiPercent).toBeUndefined();

        const totals = response.body.project.totals as {totalRevenue: number; totalCosts: number; netProfit: number}[];
        expect(totals).toHaveLength(2);
        expect(totals.map(({totalRevenue, totalCosts, netProfit}) => ({totalRevenue, totalCosts, netProfit})).sort((a, b) => a.totalRevenue - b.totalRevenue))
            .toEqual([{totalRevenue: 500, totalCosts: 120, netProfit: 380}, {totalRevenue: 1000, totalCosts: 230.1, netProfit: 769.9}]);
    }));
});
