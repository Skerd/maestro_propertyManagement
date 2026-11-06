import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// The local maestro/.env may not enable propertyManagement; its eraser is what this test is about.
vi.mock("@coreModule/utilities/modules/enabledModules", async (importOriginal) => ({
    ...await importOriginal<typeof import("@coreModule/utilities/modules/enabledModules")>(),
    isModuleEnabled: (name: string) => ["core", "propertyManagement"].includes(name),
}));
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const {deletedFiles} = vi.hoisted(() => ({deletedFiles: [] as string[]}));
vi.mock("@coreModule/utilities/gridfs/gridfsStorage", () => ({
    getGridFSStorage: () => ({deleteFile: async (id: string) => void deletedFiles.push(id)}),
}));

import {appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as privacyRoute from "@coreModule/api/company/private/privacy";
import {loadPersonErasers} from "@coreModule/utilities/erasure/personErasure";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import AuditLog from "@coreModule/database/schemas/auditLog/auditLog";
import Lead from "@propertyManagement/database/schemas/lead/lead";
import MarketingPreference from "@propertyManagement/database/schemas/marketingPreference/marketingPreference";
import AdCampaignRecipient from "@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";

const company = new ObjectId();
const accountId = new ObjectId();
const EMAIL = "ada@example.com";
const app = appFor([{...privacyRoute, module: "core"}]);
const admin: TestCaller = {userId: new ObjectId().toString(), companyId: company.toString(), isAdmin: true, modules: ["core", "propertyManagement"]};
const ids = {lead: new ObjectId(), otherLead: new ObjectId(), preference: new ObjectId(), reservation: new ObjectId()};
const raw = <T>(fn: () => Promise<T>) => asCrossTenant("test reads raw collections", fn);

beforeAll(async () => {
    await connectTestDatabase();
    // Every module's eraser (and so its models) first, then every index: a collection or index created while the
    // erasure's transaction is open aborts it.
    await loadPersonErasers();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    await raw(async () => {
        const {default: User} = await import("@coreModule/database/schemas/user/user");
        await User.collection.insertOne({_id: accountId, username: EMAIL});
        await Lead.collection.insertMany([
            {_id: ids.lead, company, firstName: "Ada", lastName: "Lovelace", email: EMAIL, phone: "+41 1", deletedAt: null},
            {_id: ids.otherLead, company, firstName: "Marco", lastName: "Rossi", email: "marco@example.com", deletedAt: null},
        ]);
        await MarketingPreference.collection.insertOne({_id: ids.preference, company, email: EMAIL, lead: ids.lead, allowPriceChange: true, allowOffers: true, allowNewProjects: true, deletedAt: null});
        await AdCampaignRecipient.collection.insertOne({company, email: EMAIL, lead: ids.lead, firstName: "Ada", status: "sent", deletedAt: null});
        await Reservation.collection.insertOne({_id: ids.reservation, company, client: accountId, reservationNotes: "prefers calls after 6", depositAmount: 5000, deletedAt: null});
        await AuditLog.collection.insertOne({company, collectionName: "leads", documentId: ids.lead, action: "CREATE", diff: {firstName: {from: null, to: "Ada"}, email: {from: null, to: EMAIL}}});
    });
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

describe("person erasure in real estate (D57)", {timeout: 60000}, () => {
    it("deletes the lead and its history's values, keeps them unsubscribed, and keeps reservations without notes", async () => {
        const erased = await request(app).post("/api/privacy/erasePerson").set(callerHeader(admin)).send({email: EMAIL, preview: false});
        expect(erased.body.error_code ?? "ok").toBe("ok");

        expect(await raw(() => Lead.collection.countDocuments({_id: ids.lead}))).toBe(0);
        expect((await raw(() => Lead.collection.findOne({_id: ids.otherLead})))).toMatchObject({email: "marco@example.com"});
        expect(await raw(() => AdCampaignRecipient.collection.countDocuments({}))).toBe(0);
        const preference = (await raw(() => MarketingPreference.collection.findOne({_id: ids.preference})))!;
        expect(preference).toMatchObject({email: EMAIL, allowPriceChange: false, allowOffers: false, allowNewProjects: false});
        expect(preference.unsubscribedAllAt).toBeInstanceOf(Date);
        expect(preference.lead).toBeUndefined();
        const reservation = (await raw(() => Reservation.collection.findOne({_id: ids.reservation})))!;
        expect(reservation).toMatchObject({depositAmount: 5000});
        expect(reservation.reservationNotes).toBeUndefined();
        expect((await raw(() => AuditLog.collection.findOne({documentId: ids.lead})))!.diff).toEqual({firstName: {from: null, to: null}, email: {from: null, to: null}});
    });
});
