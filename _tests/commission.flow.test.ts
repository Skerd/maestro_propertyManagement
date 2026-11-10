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
// The client's "reservation paid" email is not what these tests are about.
vi.mock("@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchReservationClientEmail: vi.fn(async () => true),
}));

import {allPermissionTags} from "@coreModule/_tests/httpHarness";
import {ReservationActions} from "@propertyManagement/database/schemas/reservation/reservation.actions";
import {CommissionActions} from "@propertyManagement/database/schemas/commission/commission.actions";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, clearDatabase, decString, seedCurrency, seedReservation, seedUnit, seedUser} from "./sale.fixtures";
import Role from "@coreModule/database/schemas/role/role";
import RolePermission from "@coreModule/database/schemas/rolePermission/rolePermission";
import User from "@coreModule/database/schemas/user/user";
import {actionPermissionTag} from "@coreModule/utilities/security/actionPermissions";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const params = actor(companyId, allPermissionTags([Commission]));
const reservations = new ReservationActions();
const commissions = new CommissionActions();

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

let chf: ObjectId;
let client: ObjectId;

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    mocks.emit.mockReset();
    chf = await seedCurrency(companyId, "CHF");
    client = await seedUser(companyId);
}));

/** An unpaid 5,000.00 reservation holding a unit whose reservation commission is 3 %. */
async function seedUnpaidReservation() {
    const unit = await seedUnit(companyId, {price: "250000.00", priceCurrency: chf, status: UnitStatus.RESERVED});
    await mongoose.connection.db!.collection("units").updateOne({_id: unit}, {$set: {reservationCommissionRatePercent: 3}});
    const reservation = await seedReservation(companyId, {unit, client, depositAmount: "5000.00", depositCurrency: chf, paid: false});
    await mongoose.connection.db!.collection("units").updateOne({_id: unit}, {$set: {reservation}});
    return reservation;
}

const commissionOf = async (reservation: ObjectId) => (await Commission.findOne({sourceId: reservation}).lean())!;
const run = (method: "requestApproval" | "markPaid" | "reversePayment" | "pay", _id: ObjectId) =>
    method === "pay" || method === "reversePayment"
        ? reservations[method]({...params, _id: _id.toString()})
        : commissions[method]({...params, _id: _id.toString()});

describe("a reservation commission", {timeout: 60000}, () => {
    it("is recorded on payment as an exact share of the deposit, then approved and paid", () => asCompany(async () => {
        const reservation = await seedUnpaidReservation();
        await run("pay", reservation);
        let commission = await commissionOf(reservation);
        expect([commission.status, decString(commission.amount), decString(commission.basisAmount)]).toEqual(["pending", "150.00", "5000.00"]);

        await expect(run("markPaid", commission._id)).rejects.toMatchObject({error_code: "commission_not_approved"});
        await run("requestApproval", commission._id);
        expect((await commissionOf(reservation)).status).toBe("pending_approval");

        await commissions.approvePayment({...params, _id: commission._id.toString(), decision: "approved"});
        expect((await commissionOf(reservation)).status).toBe("approved");

        await commissions.markPaid({...params, _id: commission._id.toString(), paymentReference: "BANK-7"});
        commission = await commissionOf(reservation);
        expect([commission.status, commission.paymentReference, commission.paidAt instanceof Date]).toEqual(["paid", "BANK-7", true]);

        // A paid commission keeps the deposit payment from being reversed.
        await expect(run("reversePayment", reservation)).rejects
            .toMatchObject({error_code: "reservation_payment_cannot_be_reversed_since_it_already_has_a_paid_commission"});
    }));

    it("is voided when the approval is rejected", () => asCompany(async () => {
        const reservation = await seedUnpaidReservation();
        await run("pay", reservation);
        const {_id} = await commissionOf(reservation);
        await run("requestApproval", _id);
        await commissions.approvePayment({...params, _id: _id.toString(), decision: "rejected", notes: "Agent left"});
        const commission = await commissionOf(reservation);
        expect([commission.status, commission.notes, commission.voidedAt instanceof Date]).toEqual(["voided", "Agent left", true]);
    }));

    it("is voided when the payment is reversed and owed again, once, when it is paid again", () => asCompany(async () => {
        const reservation = await seedUnpaidReservation();
        await run("pay", reservation);
        await run("reversePayment", reservation);
        let commission = await commissionOf(reservation);
        expect([commission.status, commission.voidedAt instanceof Date]).toEqual(["voided", true]);

        await run("pay", reservation);
        commission = await commissionOf(reservation);
        expect([commission.status, commission.voidedAt ?? null, decString(commission.amount)]).toEqual(["pending", null, "150.00"]);
        expect(await Commission.countDocuments({sourceId: reservation})).toBe(1);
    }));

    it("splits to the cent of its amount", () => asCompany(async () => {
        const reservation = await seedUnpaidReservation();
        await run("pay", reservation);
        const {_id} = await commissionOf(reservation);
        const agent = (await seedUser(companyId, "Second")).toString();
        await commissions.setSplits({...params, _id: _id.toString(), splits: [
            {agentId: agent, ratePercent: 33.34, amount: 50.01}, {agentId: agent, ratePercent: 33.33, amount: 49.99}, {agentId: agent, ratePercent: 33.33, amount: 50},
        ]});
        expect((await commissionOf(reservation)).splits!.map((split) => decString(split.amount))).toEqual(["50.01", "49.99", "50.00"]);
    }));
});

describe("asking for a commission payment's approval (TD-B149)", {timeout: 60000}, () => {
    it("tells the users who may approve it, not the one who asked", () => asCompany(async () => {
        const permission = new ObjectId();
        const [adminRole, approverRole, clerkRole] = [new ObjectId(), new ObjectId(), new ObjectId()];
        const [admin, approver, clerk] = [new ObjectId(), new ObjectId(), new ObjectId()];
        const member = (_id: ObjectId, role: ObjectId) => ({
            _id, username: `${_id.toString()}@test.local`, companies: [companyId], roles: [{company: companyId, active: "active", roles: [role]}],
        });
        await RolePermission.collection.insertOne({_id: permission, tag: actionPermissionTag(Commission, "approvePayment", "self")!, group: "Commissions"});
        await Role.collection.insertMany([
            {_id: adminRole, company: companyId, slug: "admin", isAdmin: true, permissions: [], deletedAt: null},
            {_id: approverRole, company: companyId, slug: "approver", isAdmin: false, permissions: [permission], deletedAt: null},
            {_id: clerkRole, company: companyId, slug: "clerk", isAdmin: false, permissions: [], deletedAt: null},
        ]);
        await User.collection.insertMany([
            member(admin, adminRole), member(approver, approverRole), member(clerk, clerkRole), member(new ObjectId(params.actionUserCtx.userId), adminRole),
        ]);
        const reservation = await seedUnpaidReservation();
        await run("pay", reservation);

        await run("requestApproval", (await commissionOf(reservation))._id);

        const asked = mocks.emit.mock.calls.filter(([code]) => code === "COMMISSION_PENDING_APPROVAL");
        expect(asked).toHaveLength(1);
        expect([...asked[0][1].receiverIds].sort()).toEqual([admin, approver].map(String).sort());
    }));
});
