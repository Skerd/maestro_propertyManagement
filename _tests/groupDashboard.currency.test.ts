import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {Decimal128, ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// No Redis in tests.
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import Company from "@coreModule/database/schemas/company/company";
import Currency from "@coreModule/database/schemas/currency/currency";
import * as groupDashboardRoute from "@propertyManagement/api/realEstate/private/groupDashboard";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import Commission from "@propertyManagement/database/schemas/commission/commission";

const companyId = new ObjectId();
const chf = new ObjectId();
const eur = new ObjectId();
const bhd = new ObjectId();
const app = appFor([{...groupDashboardRoute, module: "propertyManagement"}]);
const caller: TestCaller = {userId: new ObjectId().toString(), companyId: companyId.toString(), permissions: allPermissionTags([Sale, Commission])};
const dec = (value: string) => Decimal128.fromString(value);

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCrossTenant("test fixtures: raw rows with only the fields the dashboard reads", async () => {
    await Promise.all([Company, Currency, Sale, Commission].map((model) => model.collection.deleteMany({})));
    await Company.collection.insertOne({_id: companyId, name: "Acme Immobilien", vat: "CHE-200"});
    await Currency.collection.insertMany([
        {_id: chf, company: companyId, name: "Swiss franc", symbol: "Fr.", abbreviation: "CHF", decimalPlaces: 2},
        {_id: eur, company: companyId, name: "Euro", symbol: "€", abbreviation: "EUR", decimalPlaces: 2},
        {_id: bhd, company: companyId, name: "Bahraini dinar", symbol: "BD", abbreviation: "BHD", decimalPlaces: 3},
    ]);
    await Sale.collection.insertMany([
        {company: companyId, saleCurrency: chf, finalPrice: dec("0.10"), deletedAt: null},
        {company: companyId, saleCurrency: chf, finalPrice: dec("0.20"), deletedAt: null},
        {company: companyId, saleCurrency: eur, finalPrice: dec("250000.00"), deletedAt: null},
    ]);
    await Commission.collection.insertMany([
        // Each commission comes from its own source (a unique index).
        {company: companyId, sourceType: "sale", sourceId: new ObjectId(), currency: bhd, amount: dec("1.0005"), status: "approved", deletedAt: null},
        {company: companyId, sourceType: "sale", sourceId: new ObjectId(), currency: eur, amount: dec("99.00"), status: "voided", deletedAt: null},
    ]);
}));

describe("group dashboard money (TD-B132)", {timeout: 60000}, () => {
    it("sums revenue and commissions per currency, exactly and at each currency's decimals", async () => {
        const response = await request(app).post(groupDashboardRoute.basePath).set(callerHeader(caller)).send({});

        expect(response.status).toBe(200);
        expect(response.body.totals.totalRevenue).toEqual([
            {currency: "CHF", symbol: "Fr.", value: 0.3},
            {currency: "EUR", symbol: "€", value: 250000},
        ]);
        // The voided EUR commission does not count; the dinar rounds once at three decimals.
        expect(response.body.totals.totalCommissions).toEqual([{currency: "BHD", symbol: "BD", value: 1.001}]);
        expect(response.body.branches[0].totalRevenue).toEqual(response.body.totals.totalRevenue);
    });
});
