import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

vi.hoisted(() => {
    process.env.ENABLED_MODULES = "core,finance,propertyManagement";
});

const {catalog} = vi.hoisted(() => ({catalog: {projects: [] as {_id: string; name: string; location: string; city: string}[]}}));
// The public catalog of a company's projects is the marketing page's own (tested there); here it lists the fixtures.
vi.mock("@propertyManagement/utilities/marketing/marketingProjectsCatalog.util", () => ({
    loadMarketingProjectsCatalog: vi.fn(async () => ({projects: catalog.projects, filterOptions: {}})),
}));

import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {clearPortalProviders, getPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalNewSinceContext} from "@coreModule/domain/portal/portalProvider.types";
import Project from "@propertyManagement/database/schemas/project/project";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import {registerPropertiesPortalProvider} from "@propertyManagement/domain/portal/propertiesPortalProvider";

/* D178, P23.7: the properties section answers "which projects were listed after a date": new ones and new units. */

const agency = new ObjectId();
const since = new Date("2026-11-01T00:00:00Z");
const projects = {riviera: new ObjectId(), harbour: new ObjectId(), old: new ObjectId()};

function newSince(fields: Partial<PortalNewSinceContext> = {}) {
    const provider = getPortalProvider("properties");
    if (!provider?.newSince) throw new Error("the properties section must answer newSince");
    const ask = provider.newSince;
    return withTenant(agency, () => ask({kind: "project", scope: {companyId: agency}, companyIds: [agency], filters: {}, since, limit: 10, languageCode: "en-US", ...fields}));
}

beforeAll(async () => {
    await connectTestDatabase();
    registerPropertiesPortalProvider();
}, 120000);

afterAll(async () => {
    clearPortalProviders();
    await disconnectTestDatabase();
});

beforeEach(async () => {
    const db = mongoose.connection.db!;
    for (const collection of await db.collections()) await collection.deleteMany({});
    await db.collection("companies").insertOne({_id: agency, name: "Coast Homes", siteSlug: "coast", isActive: true, modules: ["core", "finance", "propertyManagement"], deletedAt: null});
    await Project.collection.insertMany([
        {_id: projects.riviera, company: agency, name: "Riviera", deletedAt: null, createdAt: new Date("2026-11-03T00:00:00Z")},
        {_id: projects.harbour, company: agency, name: "Harbour", deletedAt: null, createdAt: new Date("2026-05-01T00:00:00Z")},
        {_id: projects.old, company: agency, name: "Old town", deletedAt: null, createdAt: new Date("2026-04-01T00:00:00Z")},
    ]);
    await Unit.collection.insertMany([
        // A unit added to an older project after the date makes that project new to the search.
        {company: agency, project: projects.harbour, deletedAt: null, createdAt: new Date("2026-11-02T00:00:00Z")},
        {company: agency, project: projects.old, deletedAt: null, createdAt: new Date("2026-04-02T00:00:00Z")},
    ]);
    catalog.projects = [
        {_id: projects.riviera.toString(), name: "Riviera", location: "Durrës beach", city: "Durrës"},
        {_id: projects.harbour.toString(), name: "Harbour", location: "Vlorë port", city: "Vlorë"},
        {_id: projects.old.toString(), name: "Old town", location: "Berat", city: "Berat"},
    ];
});

describe("projects new since a date (P23.7)", () => {
    it("lists the projects created, or given a new unit, after the date", async () => {
        const fresh = await newSince();
        expect(fresh.total).toBe(2);
        expect(fresh.items.map((item) => item.title)).toEqual(["Riviera", "Harbour"]);
        expect(fresh.items[0]).toEqual(expect.objectContaining({kind: "project", id: projects.riviera.toString(), section: "properties", path: `/projects/${projects.riviera}`}));
    });

    it("answers nothing without reading the catalog when nothing is new", async () => {
        expect(await newSince({since: new Date("2026-12-01T00:00:00Z")})).toEqual({items: [], total: 0});
    });

    it("shows the projects a person keeps as the catalog lists them now", async () => {
        const kept = await newSince({since: new Date(0), ids: [projects.old.toString()]});
        expect(kept.items.map((item) => item.title)).toEqual(["Old town"]);
    });
});

describe("a project's page (D181)", () => {
    it("finds the project its page names, and nothing for an unknown one", async () => {
        const provider = getPortalProvider("properties");
        if (!provider?.itemAt) throw new Error("the properties section must answer itemAt");
        const itemAt = provider.itemAt;
        const at = (path: string) => withTenant(agency, () => itemAt({scope: {companyId: agency}, companyId: agency, path, languageCode: "en-US"}));
        expect(provider.sitePath).toBe("properties");
        expect(await at(`/projects/${projects.harbour.toString()}`)).toMatchObject({schemaType: "Residence", item: {title: "Harbour", city: "Vlorë"}});
        expect(await at(`/projects/${new ObjectId().toString()}`)).toBeUndefined();
    });
});
