/**
 * TD-B214: the inspection edit (PATCH) no longer moves the status; only the actions do. The cancellation reason stays
 * editable on a cancelled inspection.
 * TD-B211: the follow-up picker labels an inspection by its type and day, not its code.
 */
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
import * as inspectionRoute from "@propertyManagement/api/realEstate/private/unit/inspection";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import {asTenant, clearDatabase, findRaw, seedCurrency, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([{basePath: "/api/realEstate/unit/inspection", router: inspectionRoute.router, module: "propertyManagement"}]);
let manager: TestCaller;
let unit: ObjectId;
let inspector: ObjectId;

async function seedInspection(input: {status: string; type?: string; inspectionDate?: string; cancellationReason?: string; followUpRequired?: boolean}): Promise<ObjectId> {
    const _id = new ObjectId();
    await Inspection.collection.insertOne({
        _id, company: companyId, unit, inspectedBy: inspector, name: `INSP-${_id}`, type: input.type ?? "routine",
        inspectionDate: input.inspectionDate ?? "2026-11-20", status: input.status, followUpRequired: input.followUpRequired ?? false,
        media: [], checklistItems: [], deletedAt: null,
        ...(input.cancellationReason ? {cancellationReason: input.cancellationReason, cancelledAt: new Date()} : {}),
    });
    return _id;
}

/** The edit page's PATCH: every field it shows, the status included as the record has it or as a caller forges it. */
const patch = (_id: ObjectId, body: Record<string, unknown>) =>
    request(app).patch("/api/realEstate/unit/inspection").set(callerHeader(manager)).send({
        _id: _id.toString(), unit: unit.toString(), inspectedBy: inspector.toString(), inspectionDate: "2026-11-20", type: "routine",
        followUpRequired: false, ...body,
    });

beforeAll(async () => {
    await connectTestDatabase();
    manager = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions: allPermissionTags([Inspection])};
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    unit = await seedUnit(companyId, {price: "1000.00", priceCurrency: await seedCurrency(companyId, "EUR")});
    inspector = await seedUser(companyId);
}));

describe("PATCH /unit/inspection", {timeout: 60000}, () => {
    it("keeps the status whatever the edit sends", () => asCompany(async () => {
        const scheduled = await seedInspection({status: "scheduled"});
        for (const status of ["completed", "in_progress", "cancelled", "rescheduled"]) {
            const response = await patch(scheduled, {status, notes: `Tried ${status}`});
            expect(response.status).toBe(200);
            expect(await findRaw("inspections", scheduled)).toMatchObject({status: "scheduled", notes: `Tried ${status}`});
        }

        const cancelled = await seedInspection({status: "cancelled", cancellationReason: "Tenant away"});
        expect((await patch(cancelled, {status: "scheduled"})).status).toBe(200);
        const row = (await findRaw("inspections", cancelled))!;
        expect(row.status).toBe("cancelled");
        expect(row.cancelledAt).toBeInstanceOf(Date);
    }));

    it("edits the cancellation reason of a cancelled inspection only", () => asCompany(async () => {
        const cancelled = await seedInspection({status: "cancelled", cancellationReason: "Tenant away"});
        expect((await patch(cancelled, {status: "cancelled", cancellationReason: "Tenant abroad until December"})).status).toBe(200);
        expect((await findRaw("inspections", cancelled))!.cancellationReason).toBe("Tenant abroad until December");

        const scheduled = await seedInspection({status: "scheduled"});
        expect((await patch(scheduled, {cancellationReason: "Not cancelled"})).status).toBe(200);
        expect((await findRaw("inspections", scheduled))!.cancellationReason).toBeUndefined();
    }));
});

describe("POST /unit/inspection/select", {timeout: 60000}, () => {
    it("labels each inspection by its type and day", () => asCompany(async () => {
        await seedInspection({status: "completed", type: "pre_sale", inspectionDate: "2026-11-20", followUpRequired: true});
        await seedInspection({status: "completed", type: "routine", inspectionDate: "2026-10-05", followUpRequired: true});
        const response = await request(app).post("/api/realEstate/unit/inspection/select").set(callerHeader(manager))
            .send({page: 1, limit: 20, followUp: true});
        expect(response.status).toBe(200);
        expect(response.body.data.map((option: {label: string}) => option.label)).toEqual(["Pre-sale · Nov 20, 2026", "Routine · Oct 5, 2026"]);
    }));
});
