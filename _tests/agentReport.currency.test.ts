/**
 * The agent report keeps each agent's commissions per currency (TD-B244, GLB-08): a commission paid in CHF and one
 * paid in EUR are two rows, never one sum, and the average rate still spans every commission of the agent.
 */
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as agentReportRoute from "@propertyManagement/api/realEstate/private/agentReport";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import {asTenant, dec, seedCompany, seedCurrency, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const app = appFor([{...agentReportRoute, module: "propertyManagement"}]);
const db = () => mongoose.connection.db!;
let caller: TestCaller;
let agent: ObjectId;

const commission = (currency: ObjectId, amount: string, status: string, ratePercent: number) => ({
    _id: new ObjectId(), company: companyId, agent, sourceType: "sale", sourceId: new ObjectId(), basis: "sale_final_price",
    basisAmount: dec("100000.00"), ratePercent, amount: dec(amount), currency, status,
    createdAt: new Date("2026-06-10T10:00:00Z"), deletedAt: null,
});

beforeAll(async () => {
    await connectTestDatabase();
    caller = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true, permissions: allPermissionTags([Commission])};
    await asTenant(companyId)(async () => {
        await seedCompany(companyId, "Europe/Zurich");
        const eur = await seedCurrency(companyId, "EUR");
        const chf = await seedCurrency(companyId, "CHF");
        agent = await seedUser(companyId, "Agent");
        await db().collection("commissions").insertMany([
            commission(eur, "1000.10", "paid", 4),
            commission(eur, "500.00", "paid", 2),
            commission(chf, "300.05", "paid", 3),
            commission(chf, "200.00", "pending", 3),
        ]);
    });
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

describe("agent report commissions (TD-B244)", {timeout: 60000}, () => {
    it("returns one row per currency, exactly, and the average rate across all of them", async () => {
        const res = await request(app).post("/api/realEstate/agentReport").set(callerHeader(caller))
            .send({dateFrom: "2026-06-01", dateTo: "2026-06-30"});
        expect(res.status).toBe(200);
        const entry = res.body.entries.find((row: {agent: {_id: string}}) => row.agent._id === agent.toString());
        const byCode = (rows: {currencySymbol?: string; value: number}[]) =>
            Object.fromEntries(rows.map((row) => [row.currencySymbol, row.value]));
        expect(byCode(entry.commissionsPaid)).toEqual({EUR: 1500.1, CHF: 300.05});
        expect(byCode(entry.commissionsPending)).toEqual({CHF: 200});
        expect(entry.averageCommissionRate).toBe(3);
    });
});
