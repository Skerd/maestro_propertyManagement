/**
 * TD-B254: every company that gets property management (a self-serve sign-up, the panel's create, the platform's Manage
 * modules) starts with a few unit categories and unit types, named in the language it got the module in, so it can add
 * its first unit at once. Seeding again adds nothing and keeps the company's own edits; each company gets its own set.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

// The harness stub, with the caller's company marked as the platform owner, as authMW loads it.
vi.mock("@coreModule/utilities/middlewares/authMW", async () => {
    const {authMWStub} = await import("@coreModule/_tests/httpHarness");
    return {
        default: (scope?: string) => (req: {body: Record<string, unknown>}, res: unknown, next: () => void) =>
            authMWStub.default(scope)(req, res, () => {
                req.body.company = {...(req.body.company as Record<string, unknown>), isPlatformOwner: true};
                next();
            }),
    };
});
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {getLogger} from "@coreModule/loggers/serverLog";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import Company from "@coreModule/database/schemas/company/company";
import UnitType from "@propertyManagement/database/schemas/unitType/unitType";
import UnitTypeCategory from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory";
import {moduleBootstrap} from "@propertyManagement/database/moduleBootstrap";
import {starterUnitTypes} from "@propertyManagement/database/schemas/unitType/unitType.defaults";
import {runModuleCompanyDefaults} from "@coreModule/utilities/modules/moduleCompanyDefaults";
import request from "supertest";
import {appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {router as platformCompanies} from "@coreModule/api/platform/private/companies";
import {clearDatabase} from "./sale.fixtures";

const logger = getLogger("pm_starter_unit_types_test");
const db = () => mongoose.connection.db!;
const albanian = new ObjectId();
const english = new ObjectId();
const creator = new ObjectId();

/**
 * As the portal's sign-up gives a company the module: the module's starter records (what creating a company runs, as
 * core finds them), then the business type's own hook, in the new company's tenant, inside the sign-up's transaction.
 */
async function signedUp(companyId: ObjectId, languageCode: string): Promise<void> {
    const onCreated = moduleBootstrap.selfServeBusinessTypes.find((type) => type.key === "propertyManagement")?.onCreated;
    if (!onCreated) throw new Error("propertyManagement declares no onCreated");
    const company = await Company.findById(companyId);
    if (!company) throw new Error("test company was not seeded");
    await runInTransaction(logger, async (session) => {
        await runModuleCompanyDefaults(company, ["propertyManagement"], {session, logger, languageCode});
        await withTenant(companyId, () => onCreated({company, session, logger, languageCode}));
    });
}

const categoriesOf = (companyId: ObjectId) =>
    db().collection("unittypecategories").find({company: companyId}).sort({name: 1}).toArray();
const typesOf = (companyId: ObjectId) =>
    db().collection("unittypes").find({company: companyId}).sort({slug: 1}).toArray();

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all([UnitType.init(), UnitTypeCategory.init()]);
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(async () => {
    await clearDatabase();
    await db().collection("companies").insertMany([
        {_id: albanian, name: "Tirana Homes", createdBy: creator, modules: ["propertyManagement"], deletedAt: null},
        {_id: english, name: "London Homes", createdBy: creator, modules: ["propertyManagement"], deletedAt: null},
    ]);
});

describe("starter unit categories and types (TD-B254)", {timeout: 60000}, () => {
    it("gives a new company Residential and Commercial with their types, in its language", async () => {
        await signedUp(albanian, "sq-AL");

        const categories = await categoriesOf(albanian);
        expect(categories.map((row) => row.name)).toEqual(["Komerciale", "Rezidenciale"]);
        const categoryName = new Map(categories.map((row) => [row._id.toString(), row.name]));

        const types = await typesOf(albanian);
        expect(types.map((row) => [row.slug, row.name, categoryName.get(row.category.toString())])).toEqual([
            ["apartment-1-bedroom", "Apartament 1+1", "Rezidenciale"],
            ["apartment-2-bedroom", "Apartament 2+1", "Rezidenciale"],
            ["apartment-3-bedroom", "Apartament 3+1", "Rezidenciale"],
            ["office", "Zyrë", "Komerciale"],
            ["shop", "Dyqan", "Komerciale"],
            ["studio", "Garsonierë", "Rezidenciale"],
        ]);
        for (const row of [...categories, ...types]) {
            expect(row.createdBy?.toString()).toBe(creator.toString());
            expect(row.deletedAt ?? null).toBeNull();
        }
        // The hook's own part still runs: the agency opts in to the portal.
        expect((await db().collection("propertymanagementconfigs").findOne({company: albanian}))?.listedOnPortal).toBe(true);
    });

    it("adds nothing when it runs again, and keeps the company's renames and deletions", async () => {
        await signedUp(albanian, "sq-AL");
        await db().collection("unittypes").updateOne({company: albanian, slug: "studio"}, {$set: {name: "Studio e vogël"}});
        await db().collection("unittypes").updateOne({company: albanian, slug: "office"}, {$set: {deletedAt: new Date()}});

        await signedUp(albanian, "sq-AL");

        expect(await categoriesOf(albanian)).toHaveLength(2);
        const types = await typesOf(albanian);
        expect(types).toHaveLength(starterUnitTypes.length);
        expect(types.find((row) => row.slug === "studio")?.name).toBe("Studio e vogël");
        expect(types.find((row) => row.slug === "office")?.deletedAt).toBeInstanceOf(Date);
    });

    it("gives each company its own set, and English for a language the platform does not ship", async () => {
        await signedUp(albanian, "sq-AL");
        await signedUp(english, "es-ES");

        expect((await categoriesOf(english)).map((row) => row.name)).toEqual(["Commercial", "Residential"]);
        const englishTypes = await typesOf(english);
        expect(englishTypes.map((row) => row.name).sort()).toEqual(
            ["1-bedroom apartment", "2-bedroom apartment", "3-bedroom apartment", "Office", "Shop", "Studio"],
        );
        const englishCategories = new Set((await categoriesOf(english)).map((row) => row._id.toString()));
        expect(englishTypes.every((row) => englishCategories.has(row.category.toString()))).toBe(true);
        expect(await typesOf(albanian)).toHaveLength(starterUnitTypes.length);
    });
});

describe("a company the platform grants property management (TD-B254)", {timeout: 120000}, () => {
    const platform = new ObjectId();
    const granted = new ObjectId();
    const admin: TestCaller = {userId: creator.toString(), companyId: platform.toString(), isAdmin: true, modules: ["core"]};
    const app = appFor([{basePath: "/api/platform/companies", router: platformCompanies, module: "core"}]);

    it("starts with the starter set, named in the language of the request that granted it", async () => {
        await db().collection("companies").insertMany([
            {_id: platform, company: platform, name: "Platform", isPlatformOwner: true, isActive: true, modules: ["core"], deletedAt: null},
            {_id: granted, company: granted, name: "Durrës Homes", createdBy: creator, isActive: true, modules: ["core"], deletedAt: null},
        ]);

        // The test harness signs every request in English.
        const res = await request(app).put(`/api/platform/companies/modules/${granted.toString()}`)
            .set(callerHeader(admin)).send({modules: ["core", "propertyManagement"]});

        expect([res.status, res.body.error_code]).toEqual([200, undefined]);
        expect((await categoriesOf(granted)).map((row) => row.name)).toEqual(["Commercial", "Residential"]);
        expect(await typesOf(granted)).toHaveLength(starterUnitTypes.length);
    });
});
