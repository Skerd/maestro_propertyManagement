/** TD-B200: delivering a modification request records that its client was told, which the sheet's Notifications group shows. */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

const mocks = vi.hoisted(() => ({emit: vi.fn()}));

// Notices are recorded, not delivered.
vi.mock("@coreModule/domain/notifications/notificationEventBus", async (importOriginal) => ({
    ...await importOriginal<object>(),
    emitNotificationEvent: mocks.emit,
}));

import {ModificationRequestActions} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.actions";
import {actor, asTenant, clearDatabase, findRaw, seedCurrency, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const params = actor(companyId);
const requests = new ModificationRequestActions();
const db = () => mongoose.connection.db!;

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    mocks.emit.mockReset();
    await clearDatabase();
}));

async function seedRequest(requestedBy?: ObjectId): Promise<ObjectId> {
    const eur = await seedCurrency(companyId, "EUR");
    const unit = await seedUnit(companyId, {price: "200000.00", priceCurrency: eur});
    const _id = new ObjectId();
    await db().collection("modificationrequests").insertOne({
        _id, company: companyId, unit, title: "Kitchen layout", status: "finance_completed", notificationSent: false,
        ...(requestedBy ? {requestedBy} : {}), deletedAt: null,
    });
    return _id;
}

describe("delivering a modification request", {timeout: 60000}, () => {
    it("stamps when the requesting client was notified", () => asCompany(async () => {
        const client = await seedUser(companyId, "Client");
        const request = await seedRequest(client);
        await requests.deliver({...params, _id: request.toString()});

        const row = (await findRaw("modificationrequests", request))!;
        expect(row.status).toBe("completed");
        expect(row.notificationSent).toBe(true);
        expect(row.clientNotifiedAt).toBeInstanceOf(Date);
        expect(mocks.emit).toHaveBeenCalledWith("MODIFICATION_REQUEST_DELIVERED", expect.objectContaining({receiverIds: [client.toString()]}));
    }));

    it("leaves the stamp off when nobody requested it, so nobody was notified", () => asCompany(async () => {
        const request = await seedRequest();
        await requests.deliver({...params, _id: request.toString()});

        const row = (await findRaw("modificationrequests", request))!;
        expect(row.status).toBe("completed");
        expect(row.notificationSent).toBe(false);
        expect(row.clientNotifiedAt).toBeUndefined();
        expect(mocks.emit).not.toHaveBeenCalled();
    }));
});
