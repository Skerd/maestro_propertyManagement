/** TD-B199: a contractor's sheet and list carry the buildings it works on, read with the caller's own grants. */
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
import * as constructorRoute from "@propertyManagement/api/realEstate/private/constructor";
import Constructor from "@propertyManagement/database/schemas/constructor/constructor";
import Edifice from "@propertyManagement/database/schemas/edifice/edifice";
import {asTenant, clearDatabase} from "./sale.fixtures";

const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([{basePath: "/api/realEstate/constructor", router: constructorRoute.router, module: "propertyManagement"}]);

let manager: TestCaller;
let contractorsOnly: TestCaller;

const seedConstructor = async (name: string): Promise<ObjectId> => {
    const _id = new ObjectId();
    await Constructor.collection.insertOne({_id, company: companyId, name, email: `${_id}@example.com`, vat: `VAT-${_id}`, addresses: [], deletedAt: null});
    return _id;
};
const seedEdifice = (company: ObjectId, name: string, constructors: ObjectId[], deletedAt: Date | null = null) =>
    Edifice.collection.insertOne({_id: new ObjectId(), company, project: new ObjectId(), name, constructors, deletedAt});
const names = (rows: {name: string}[] | undefined) => (rows ?? []).map((row) => row.name);

beforeAll(async () => {
    await connectTestDatabase();
    const caller = (permissions: string[]): TestCaller => ({userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions});
    manager = caller(allPermissionTags([Constructor, Edifice]));
    contractorsOnly = caller(allPermissionTags([Constructor]));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(clearDatabase));

describe("a contractor's buildings", {timeout: 60000}, () => {
    it("lists this company's live buildings of each contractor by name, on the sheet and in the list", () => asCompany(async () => {
        const builder = await seedConstructor("Builder");
        const electrician = await seedConstructor("Electrician");
        await seedEdifice(companyId, "Tower B", [builder, electrician]);
        await seedEdifice(companyId, "Tower A", [builder]);
        await seedEdifice(companyId, "Old wing", [builder], new Date());
        await seedEdifice(otherCompanyId, "Foreign", [builder]);

        const single = await request(app).post("/api/realEstate/constructor/single").set(callerHeader(manager)).send({_id: builder.toString()});
        expect(single.status).toBe(200);
        expect(names(single.body.edifices)).toEqual(["Tower A", "Tower B"]);

        const list = await request(app).post("/api/realEstate/constructor").set(callerHeader(manager)).send({offset: 0, limit: 20});
        expect(list.status).toBe(200);
        const byName = Object.fromEntries(list.body.data.map((row: {name: string; edifices?: {name: string}[]}) => [row.name, names(row.edifices)]));
        expect(byName).toEqual({Builder: ["Tower A", "Tower B"], Electrician: ["Tower B"]});
    }));

    it("leaves the buildings out for a role that may not read buildings", () => asCompany(async () => {
        const builder = await seedConstructor("Builder");
        await seedEdifice(companyId, "Tower A", [builder]);

        const single = await request(app).post("/api/realEstate/constructor/single").set(callerHeader(contractorsOnly)).send({_id: builder.toString()});
        expect(single.status).toBe(200);
        expect(single.body.name).toBe("Builder");
        expect(single.body.edifices).toBeUndefined();
    }));
});
