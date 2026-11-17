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

import {runModificationRequestSlaEscalations} from "@propertyManagement/utilities/cronJobs/modificationRequestSlaJob";
import {asTenant, clearDatabase} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;
const ids = {client: new ObjectId(), financeOfficer: new ObjectId(), architect: new ObjectId(), admin: new ObjectId()};

function member(_id: ObjectId, roles: ObjectId[]) {
    return {
        _id, name: "Test", surname: "User", username: `${_id.toString()}@example.com`, companies: [companyId], deletedAt: null,
        roles: [{company: companyId, active: "active", roles, rolesCount: roles.length, unsuccessfulLogins: 0, lockedOutUntil: null, lastLogin: null}],
    };
}

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    mocks.emit.mockReset();
    await clearDatabase();
    for (const name of ["rolepermissions", "roles", "users"]) await db().collection(name).deleteMany({});
    const [finance, approve] = [new ObjectId(), new ObjectId()];
    await db().collection("rolepermissions").insertMany([
        {_id: finance, tag: "modificationrequests[action:finance]"},
        {_id: approve, tag: "modificationrequests[action:approve]"},
    ]);
    const [financeRole, architectRole, adminRole] = [new ObjectId(), new ObjectId(), new ObjectId()];
    await db().collection("roles").insertMany([
        {_id: financeRole, company: companyId, name: "Finance", slug: "finance", isAdmin: false, permissions: [finance]},
        {_id: architectRole, company: companyId, name: "Architect", slug: "architect", isAdmin: false, permissions: [approve]},
        {_id: adminRole, company: companyId, name: "Admin", slug: "admin", isAdmin: true, permissions: []},
    ]);
    await db().collection("users").insertMany([
        member(ids.client, []), member(ids.financeOfficer, [financeRole]), member(ids.architect, [architectRole]), member(ids.admin, [adminRole]),
    ]);
}));

const overdue = (status: string) => db().collection("modificationrequests").insertOne({
    _id: new ObjectId(), company: companyId, title: "Kitchen layout", status, requestedBy: ids.client,
    stageDueDate: new Date(Date.now() - 86_400_000), deletedAt: null,
});
const receivers = () => mocks.emit.mock.calls.map(([, args]) => (args.receiverIds as string[]).slice().sort());

// TD-B243: a breached SLA alerted the client who asked for the change, never the staff who had to move it on.
describe("modification request SLA breach", {timeout: 60000}, () => {
    it("alerts whoever may act at the stage it is stuck in, not the client", () => asCompany(async () => {
        await overdue("pending_finance");
        await runModificationRequestSlaEscalations(companyId);

        expect(mocks.emit).toHaveBeenCalledWith("MODIFICATION_REQUEST_SLA_BREACHED", expect.anything());
        expect(receivers()).toEqual([[ids.admin.toString(), ids.financeOfficer.toString()].sort()]);
    }));

    it("sends a review stage to the approvers", () => asCompany(async () => {
        await overdue("pending_architect");
        await runModificationRequestSlaEscalations(companyId);

        expect(receivers()).toEqual([[ids.admin.toString(), ids.architect.toString()].sort()]);
    }));
});
