/** TD-B217: the unit and inspection pickers label a stored value by its id, whatever page, search or narrowing the form posts. */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as unitRoute from "@propertyManagement/api/realEstate/private/unit/unit";
import * as inspectionRoute from "@propertyManagement/api/realEstate/private/unit/inspection";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import UnitType from "@propertyManagement/database/schemas/unitType/unitType";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import {asTenant, clearDatabase, seedCurrency, seedUnit} from "./sale.fixtures";

const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([
    {basePath: "/api/realEstate/unit", router: unitRoute.router},
    {basePath: "/api/realEstate/unit/inspection", router: inspectionRoute.router},
].map((route) => ({...route, module: "propertyManagement"})));
const manager: TestCaller = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions: allPermissionTags([Unit, UnitType, Inspection])};
const select = (path: string, body: Record<string, unknown>) =>
    request(app).post(`/api/realEstate/${path}/select`).set(callerHeader(manager)).send({page: 1, ...body});
const values = (response: request.Response) => (response.body.data as {value: string}[]).map((option) => option.value);

async function seedInspection(company: ObjectId, followUpRequired: boolean): Promise<ObjectId> {
    const _id = new ObjectId();
    await Inspection.collection.insertOne({
        _id, company, unit: new ObjectId(), inspectedBy: new ObjectId(), name: `INSP-${_id}`, type: "routine",
        inspectionDate: "2026-11-20", status: "scheduled", followUpRequired, media: [], checklistItems: [], deletedAt: null,
    });
    return _id;
}

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(clearDatabase));

describe("PM pickers select by ids", {timeout: 60000}, () => {
    it("labels a unit past the first page and outside the form's project, never another company's", () => asCompany(async () => {
        const currency = await seedCurrency(companyId, "EUR");
        const units: ObjectId[] = [];
        for (let index = 0; index < 3; index++) units.push(await seedUnit(companyId, {price: "1000.00", priceCurrency: currency}));
        const foreign = await asTenant(otherCompanyId)(async () => seedUnit(otherCompanyId, {price: "1000.00", priceCurrency: await seedCurrency(otherCompanyId, "EUR")}));

        const firstPage = await select("unit", {limit: 1});
        expect(firstPage.body.total).toBe(3);
        const pastPage = units.find((unit) => unit.toString() !== values(firstPage)[0])!;
        // The form narrows to a project the unit is not in, and excludes it as "this unit".
        const narrowing = {project: new ObjectId().toString(), notId: pastPage.toString(), notConnected: true, name: "no such unit"};
        expect((await select("unit", {limit: 1, ...narrowing})).body.data).toEqual([]);

        const byId = await select("unit", {limit: 1, ...narrowing, ids: [pastPage.toString(), foreign.toString()]});
        expect(byId.status).toBe(200);
        expect(byId.body.data).toEqual([{value: pastPage.toString(), label: `U-${pastPage.toString().slice(-4)} - Apartment`}]);
    }));

    it("labels a follow-up's inspection that no longer needs a follow-up", () => asCompany(async () => {
        const needsFollowUp = await seedInspection(companyId, true);
        const done = await seedInspection(companyId, false);
        const foreign = await asTenant(otherCompanyId)(() => seedInspection(otherCompanyId, false));

        expect(values(await select("unit/inspection", {limit: 20, followUp: true}))).toEqual([needsFollowUp.toString()]);

        const byId = await select("unit/inspection", {limit: 20, followUp: true, notId: done.toString(), ids: [done.toString(), foreign.toString()]});
        expect(byId.status).toBe(200);
        expect(byId.body.data).toEqual([{value: done.toString(), label: "Routine · Nov 20, 2026"}]);
    }));
});
