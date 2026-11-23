/**
 * A property inquiry from a company's site (D178, P23.9): the lead is saved, and once it is committed the visitor gets a
 * confirmation naming the project and unit, with a link to their account on the portal. A failed email never fails the
 * inquiry (BE-08).
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

const {companyId, sent} = vi.hoisted(() => {
    process.env.SINFONIA_CLIENT_URLS = "core=http://panel.example.test:5211,portal=http://portal.example.test:5212";
    return {companyId: {value: ""}, sent: [] as Record<string, unknown>[]};
});

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
            return {_id: new Id(companyId.value), name: "Riverside Homes"};
        },
    };
});
const sendInquiryClientMail = vi.fn(async (mail: Record<string, unknown>) => {
    sent.push(mail);
});
vi.mock("@propertyManagement/utilities/emails/inquiryNotifiers", () => ({
    sendInquiryClientMail: (mail: Record<string, unknown>) => sendInquiryClientMail(mail),
}));

import {appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as marketingContactRoute from "@propertyManagement/api/realEstate/public/marketingContact";
import "@propertyManagement/database/schemas/lead/lead";

const company = new ObjectId();
companyId.value = company.toString();
const app = appFor([{...marketingContactRoute, module: "propertyManagement"}]);
const visitor: TestCaller = {userId: new ObjectId().toString(), companyId: company.toString()};
const projectId = new ObjectId();
const unitId = new ObjectId();

const db = () => mongoose.connection.db!;

const inquiry = (overrides: Record<string, unknown> = {}) => request(app)
    .post("/api/realEstate/marketingContact")
    .set(callerHeader(visitor))
    .send({name: "Ann", surname: "Lee", email: "Ann@Example.com", phone: "+355 69 000 0000", message: "Is it still free?", ...overrides});

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(async () => {
    sent.length = 0;
    sendInquiryClientMail.mockClear();
    await Promise.all(["leads", "projects", "units"].map((name) => db().collection(name).deleteMany({})));
    await db().collection("projects").insertOne({_id: projectId, company, name: "Riverside", deletedAt: null});
    await db().collection("units").insertOne({_id: unitId, company, project: projectId, unitNumber: "A-101", name: "Garden flat", deletedAt: null});
});

describe("POST /api/realEstate/marketingContact", {timeout: 60000}, () => {
    it("saves the lead and confirms the inquiry to the visitor, naming the unit and its project", async () => {
        const res = await inquiry({unitInterest: unitId.toString()});
        expect(res.body).toEqual({ok: true});

        const lead = await db().collection("leads").findOne({email: "ann@example.com"});
        expect(lead).toMatchObject({company, unitInterest: unitId, projectInterest: projectId});
        expect(sent).toEqual([{
            email: "ann@example.com",
            fullName: "Ann Lee",
            languageCode: "en-US",
            companyId: company.toString(),
            companyName: "Riverside Homes",
            projectName: "Riverside",
            unitNumber: "A-101",
            unitName: "Garden flat",
            accountUrl: "http://portal.example.test:5212/account",
        }]);
    });

    it("confirms a general message without a property", async () => {
        const res = await inquiry();
        expect(res.body).toEqual({ok: true});
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({companyName: "Riverside Homes", projectName: undefined, unitNumber: undefined});
    });

    it("keeps the inquiry when the email fails", async () => {
        sendInquiryClientMail.mockRejectedValueOnce(new Error("SMTP down"));
        const res = await inquiry({projectInterest: projectId.toString()});
        expect(res.body).toEqual({ok: true});
        expect(await db().collection("leads").countDocuments({email: "ann@example.com"})).toBe(1);
    });

    it("sends nothing when the inquiry is refused", async () => {
        const res = await inquiry({projectInterest: new ObjectId().toString()});
        expect(res.body.error_code).toBe("project_not_found");
        expect(sent).toHaveLength(0);
        expect(await db().collection("leads").countDocuments({})).toBe(0);
    });
});
