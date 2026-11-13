/** P13.3 debt: floor, unit and PD forms post the picked project to the building picker, which must list only its buildings. */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {edificeSelectFilter} from "@propertyManagement/utilities/edifice/edificeSelectFilter";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
// TD-B193: importing the building routes used to hang the test worker (the PDF generator's opencv.js is a thenable).
import * as edificeRoute from "@propertyManagement/api/realEstate/private/edifice";
import Edifice from "@propertyManagement/database/schemas/edifice/edifice";
import {asTenant, clearDatabase} from "./sale.fixtures";

describe("building picker filter", () => {
    it("keeps the posted project's buildings", () => {
        const project = new ObjectId();
        expect(edificeSelectFilter({project: project.toString()})).toEqual({project});
    });

    it("offers every building when no project, or a malformed one, is posted", () => {
        expect(edificeSelectFilter({})).toEqual({});
        expect(edificeSelectFilter({project: ""})).toEqual({});
        expect(edificeSelectFilter({project: "not-an-id"})).toEqual({});
    });
});

describe("POST /edifice/select", {timeout: 60000}, () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const asCompany = asTenant(companyId);
    const app = appFor([{basePath: "/api/realEstate/edifice", router: edificeRoute.router, module: "propertyManagement"}]);
    let manager: TestCaller;

    const seedEdifice = (company: ObjectId, project: ObjectId, name: string) =>
        Edifice.collection.insertOne({_id: new ObjectId(), company, project, name, deletedAt: null});
    const labels = async (body: Record<string, unknown>): Promise<string[]> => {
        const response = await request(app).post("/api/realEstate/edifice/select").set(callerHeader(manager)).send({page: 1, limit: 20, ...body});
        expect(response.status).toBe(200);
        return response.body.data.map((option: {label: string}) => option.label);
    };

    beforeAll(async () => {
        await connectTestDatabase();
        manager = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions: allPermissionTags([Edifice])};
    }, 120000);

    afterAll(async () => {
        await disconnectTestDatabase();
    });

    beforeEach(() => asCompany(clearDatabase));

    it("lists only the posted project's buildings of the company, and every building without a project", () => asCompany(async () => {
        const garda = new ObjectId();
        const aria = new ObjectId();
        await seedEdifice(companyId, garda, "Garda A");
        await seedEdifice(companyId, garda, "Garda B");
        await seedEdifice(companyId, aria, "Aria A");
        await seedEdifice(otherCompanyId, garda, "Foreign");

        expect(await labels({project: garda.toString()})).toEqual(["Garda A", "Garda B"]);
        expect(await labels({})).toEqual(["Aria A", "Garda A", "Garda B"]);
        expect(await labels({project: "not-an-id"})).toEqual(["Aria A", "Garda A", "Garda B"]);
    }));
});
