/**
 * D191: the platform hides a reported project; it and its units leave the company's website, the portal's catalog and
 * the site's counts, while staff still see it.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

const {companyId} = vi.hoisted(() => ({companyId: {value: ""}}));

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
// The company a site's origin names, as resolveCompanyByOrigin finds it and makes it the request's tenant.
vi.mock("@propertyManagement/utilities/marketing/marketingCompany.util", async () => {
    const {setRequestTenant} = await import("@coreModule/utilities/endpoints/tenantScope");
    const {ObjectId: Id} = await import("mongodb");
    return {
        resolveMarketingCompany: async () => {
            setRequestTenant(companyId.value);
            return {_id: new Id(companyId.value), name: "Coast Homes"};
        },
    };
});

import {appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {getLogger} from "@coreModule/loggers/serverLog";
import {asCrossTenant, withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import * as marketingProjectRoute from "@propertyManagement/api/realEstate/public/marketingProject";
import * as marketingFeaturedUnitsRoute from "@propertyManagement/api/realEstate/public/marketingFeaturedUnits";
import Project from "@propertyManagement/database/schemas/project/project";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import {loadMarketingProjectsCatalog} from "@propertyManagement/utilities/marketing/marketingProjectsCatalog.util";
import {propertyManagementReportables} from "@propertyManagement/domain/reports/propertyManagementReportables";
import {setReportableHidden} from "@coreModule/domain/reports/reportDesk";

const agency = new ObjectId();
companyId.value = agency.toString();
const app = appFor([marketingProjectRoute, marketingFeaturedUnitsRoute].map((route) => ({...route, module: "propertyManagement"})));
const visitor: TestCaller = {userId: new ObjectId().toString(), companyId: agency.toString()};
const logger = getLogger("project_hidden_by_platform_test");
const projects = {riviera: new ObjectId(), harbour: new ObjectId()};
const asAgency = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(agency, fn);

const [projectKind] = propertyManagementReportables;

/** What the platform's report desk does (D191): reads the project across companies, then core hides it in its company. */
async function platformHides(recordId: ObjectId) {
    const snapshot = await asCrossTenant("the report desk reads a reported record", () =>
        projectKind.snapshot({recordId, logger, languageCode: "en-US"}));
    await setReportableHidden({...projectKind, module: "propertyManagement"}, snapshot!.companyId, {recordId, logger, languageCode: "en-US", hidden: true, decidedBy: new ObjectId()});
    return snapshot;
}

const catalogNames = async () => (await asAgency(() => loadMarketingProjectsCatalog(agency, {}, {languageCode: "en-US"}))).projects.map((project) => project.name);
const projectPage = (id: ObjectId) => request(app).post("/api/realEstate/marketingProject/single").set(callerHeader(visitor)).send({projectId: id.toString()});
const featuredUnits = () => request(app).post("/api/realEstate/marketingFeaturedUnits").set(callerHeader(visitor)).send({});

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(async () => {
    const db = mongoose.connection.db!;
    for (const collection of await db.collections()) await collection.deleteMany({});
    await db.collection("companies").insertOne({_id: agency, name: "Coast Homes", siteSlug: "coast", isActive: true, modules: ["core", "propertyManagement"], deletedAt: null});
    await Project.collection.insertMany([
        {_id: projects.riviera, company: agency, name: "Riviera", deletedAt: null, createdAt: new Date()},
        {_id: projects.harbour, company: agency, name: "Harbour", deletedAt: null, createdAt: new Date()},
    ]);
    await Unit.collection.insertMany([
        {company: agency, project: projects.riviera, unitNumber: "R-1", name: "Sea view flat", featuredOnHomepage: true, featuredSortOrder: 1, deletedAt: null},
        {company: agency, project: projects.harbour, unitNumber: "H-1", name: "Port loft", featuredOnHomepage: true, featuredSortOrder: 2, deletedAt: null},
    ]);
});

describe("a project the platform hides (D191)", {timeout: 60000}, () => {
    it("names the project and its portal page for the report desk", async () => {
        const snapshot = await asCrossTenant("the report desk reads a reported record", () =>
            projectKind.snapshot({recordId: projects.harbour, logger, languageCode: "en-US"}));
        expect(snapshot).toEqual({title: "Harbour", companyId: agency, url: `/properties/coast/projects/${projects.harbour}`, hidden: false});
    });

    it("leaves the website, the portal catalog and the featured units, and stays for staff", async () => {
        expect(await catalogNames()).toEqual(expect.arrayContaining(["Riviera", "Harbour"]));
        expect((await projectPage(projects.harbour)).status).toBe(200);

        await platformHides(projects.harbour);

        expect(await catalogNames()).toEqual(["Riviera"]);
        const page = await projectPage(projects.harbour);
        expect(page.body.error_code).toBe("project_not_found");
        expect((await projectPage(projects.riviera)).status).toBe(200);
        const units = await featuredUnits();
        expect(units.status).toBe(200);
        expect(JSON.stringify(units.body)).toContain("R-1");
        expect(JSON.stringify(units.body)).not.toContain("H-1");
        expect((await asAgency(() => Project.findById(projects.harbour).lean()))?.hiddenByPlatform).toBe(true);
    });
});
