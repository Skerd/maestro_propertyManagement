import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {getLogger} from "@coreModule/loggers/serverLog";
import Company from "@coreModule/database/schemas/company/company";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {createDemoClients, pmDemoClientSeeds} from "@propertyManagement/database/seeds/operations/demoClients";
import {loadOperationsRefs} from "@propertyManagement/database/seeds/operations/operationsRefs";
import {leasesSeed} from "@propertyManagement/database/seeds/operations/leases.seed";
import {reservationsSeed} from "@propertyManagement/database/seeds/operations/reservations.seed";
import {demoRecordId} from "@propertyManagement/database/seeds/workflow/workflowDemo";
import {createLeases} from "@propertyManagement/database/schemas/lease/lease.defaults";
import {createRentalPayments} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment.defaults";
import {createReservations} from "@propertyManagement/database/schemas/reservation/reservation.defaults";
import {asTenant, clearDatabase, seedCurrency, seedUnit} from "./sale.fixtures";

const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const echoId = new ObjectId();
const webClientRole = new ObjectId();
const timeZone = "Europe/Tirane";
/** The company demo seed runs as the company it seeds (D16). */
const asCompany = asTenant(companyId);
const logger = getLogger("pm_demo_seed_test");
const db = () => mongoose.connection.db!;
let eur: ObjectId;

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    await db().collection("companies").insertOne({_id: companyId, name: "Aria Estates", timezone: timeZone, createdBy: echoId, deletedAt: null});
    await db().collection("roles").insertOne({_id: webClientRole, company: companyId, name: "Web Client", slug: "aria_estates:default:webclient", isSignupDefault: true, isAdmin: false});
    await db().collection("users").insertOne({_id: echoId, username: "echo@echo.com", name: "echo", surname: "silence", companies: [companyId],
        roles: [{_id: new ObjectId(), company: companyId, roles: [], rolesCount: 0, active: "active"}], deletedAt: null});
    eur = await seedCurrency(companyId, "EUR");
    // Every company has its own EUR; the seed must pick its company's.
    await seedCurrency(otherCompanyId, "EUR");
}));

const loadCompany = async () => (await Company.findById(companyId))!;
const membershipsOf = async (username: string) =>
    ((await db().collection("users").findOne({username}))?.roles ?? []) as {company: ObjectId; roles: ObjectId[]}[];

/** One available unit per seed row, keyed by the unit id the row names. */
async function unitsFor(rows: readonly {unit: string}[]): Promise<Map<string, ObjectId>> {
    const units = new Map<string, ObjectId>();
    for (const row of rows) units.set(row.unit, await seedUnit(companyId, {price: "300000.00", priceCurrency: new ObjectId()}));
    return units;
}

describe("PM demo clients (TD-B206)", {timeout: 60000}, () => {
    it("creates each client once, as a Web Client member of the company", () => asCompany(async () => {
        const company = await loadCompany();
        await createDemoClients(logger, company);
        await createDemoClients(logger, company);

        for (const seed of pmDemoClientSeeds) {
            expect(seed.username).toMatch(/@example\.com$/);
            expect(await db().collection("users").countDocuments({username: seed.username})).toBe(1);
            const memberships = await membershipsOf(seed.username);
            expect(memberships.map((entry) => [String(entry.company), entry.roles.map(String)])).toEqual([[String(companyId), [String(webClientRole)]]]);
        }
    }));

    it("adds an existing client to the company and keeps their other memberships", () => asCompany(async () => {
        const username = pmDemoClientSeeds[0].username;
        await db().collection("users").insertOne({_id: new ObjectId(), username, password: "hashed", name: "Elira", surname: "Daka", fullName: "Elira Daka", companies: [otherCompanyId],
            roles: [{_id: new ObjectId(), company: otherCompanyId, roles: [], rolesCount: 0, active: "active"}], deletedAt: null});

        await createDemoClients(logger, await loadCompany());

        expect((await membershipsOf(username)).map((entry) => String(entry.company))).toEqual([String(otherCompanyId), String(companyId)]);
    }));
});

describe("PM demo leases and reservations (TD-B206)", {timeout: 60000}, () => {
    it("seeds the leases with the API's rent schedule and pays the months already due, once", () => asCompany(async () => {
        const company = await loadCompany();
        await createDemoClients(logger, company);
        const units = await unitsFor(leasesSeed);
        const today = localDateOf(new Date(), timeZone);

        const leaseIds = await createLeases(logger, company, await loadOperationsRefs(company), units);
        expect(leaseIds.size).toBe(leasesSeed.length);
        await createRentalPayments(logger, company, leaseIds);

        const snapshot = async () => {
            const result: Record<string, string[]> = {};
            for (const row of leasesSeed) {
                const months = await db().collection("rentalpayments").find({lease: leaseIds.get(row.id)}).sort({dueDate: 1}).toArray();
                result[row.id] = months.map((month) => `${month.dueDate} ${month.status}`);
            }
            return result;
        };
        const first = await snapshot();
        for (const row of leasesSeed) {
            const months = first[row.id];
            // A year's lease, rent due on the start's day of every month.
            expect(months).toHaveLength(12);
            expect(months[0].startsWith(row.startDate)).toBe(true);
            const due = months.filter((month) => month.slice(0, 10) <= today).length;
            const paid = Math.max(0, due - row.unpaidDueMonths);
            expect(months.map((month) => month.slice(11))).toEqual([...Array(paid).fill("paid"), ...Array(12 - paid).fill("pending")]);
            const lease = await db().collection("leases").findOne({_id: leaseIds.get(row.id)});
            expect(lease?.status).toBe("active");
            expect(String(lease?.rentCurrency)).toBe(String(eur));
            expect(String(lease?.tenant)).toBe(String((await db().collection("users").findOne({username: row.tenant.$user}))?._id));
        }

        await createLeases(logger, company, await loadOperationsRefs(company), units);
        expect(await createRentalPayments(logger, company, leaseIds)).toBe(0);
        expect(await snapshot()).toEqual(first);
    }));

    it("keeps the active reservations current and the expired ones in the past", () => asCompany(async () => {
        const company = await loadCompany();
        await createDemoClients(logger, company);
        const today = localDateOf(new Date(), timeZone);

        const ids = await createReservations(logger, company, await loadOperationsRefs(company), await unitsFor(reservationsSeed));

        expect(ids.size).toBe(reservationsSeed.length);
        const rows = await db().collection("reservations").find({}).toArray();
        const active = rows.filter((row) => row.status === "active");
        const expired = rows.filter((row) => row.status === "expired");
        expect(active.length).toBeGreaterThan(0);
        expect(expired.length).toBeGreaterThan(0);
        for (const row of active) expect(row.expirationDate >= today && row.reservationDate <= today).toBe(true);
        for (const row of expired) expect(row.expirationDate < today && row.expiredAt instanceof Date).toBe(true);
        for (const row of rows) expect(String(row.reservedBy)).toBe(String(echoId));
    }));
});

describe("PM demo seed refs (TD-B206)", () => {
    // The demo sync script runs across companies (D16), where nothing scopes the currency lookup but the seed itself.
    it("resolve the seeded company's own currencies", () => asCrossTenant("test: the demo sync runs across companies", async () => {
        const refs = await loadOperationsRefs({_id: companyId});
        expect(String(refs.currencyByCode.get("EUR"))).toBe(String(eur));
    }));
});

describe("workflow demo record ids (TD-B206)", () => {
    it("are fixed per model, company and seed key", () => {
        const id = demoRecordId("SiteDiary", companyId, "diary-today");
        expect(demoRecordId("SiteDiary", companyId, "diary-today").equals(id)).toBe(true);
        expect(demoRecordId("SiteDiary", otherCompanyId, "diary-today").equals(id)).toBe(false);
        expect(demoRecordId("Rfi", companyId, "diary-today").equals(id)).toBe(false);
        expect(demoRecordId("SiteDiary", companyId, "diary-yesterday").equals(id)).toBe(false);
    });
});
