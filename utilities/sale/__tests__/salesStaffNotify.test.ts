import {EventEmitter} from "events";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

type FixtureUser = {_id: ObjectId; username?: string; name?: string; surname?: string; companies: ObjectId[]; isActive: boolean};

const mocks = vi.hoisted(() => ({
    users: [] as FixtureUser[],
    getNotificationRecipients: vi.fn(),
    emit: vi.fn(),
    sendMail: vi.fn(),
}));

vi.mock("@coreModule/database/schemas/user/user", () => ({
    default: {
        // Mimics the Mongo filters the notifier relies on: _id $in, companies, isActive.
        find: (query: {_id: {$in: ObjectId[]}; companies?: ObjectId; isActive?: boolean}) => {
            const ids = query._id.$in.map(String);
            const rows = mocks.users.filter(u =>
                ids.includes(String(u._id))
                && (query.companies == null || u.companies.some(c => String(c) === String(query.companies)))
                && (query.isActive == null || u.isActive === query.isActive));
            return {select: () => ({lean: async () => rows})};
        },
    },
}));
vi.mock("@coreModule/domain/notifications/notificationEventBus", () => ({emitNotificationEvent: mocks.emit}));
vi.mock("@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.service", () => ({
    propertyManagementConfigService: {getNotificationRecipients: mocks.getNotificationRecipients},
}));
vi.mock("@propertyManagement/utilities/emails/staffAlertNotifiers", () => ({sendSalesStaffAlertMail: mocks.sendMail}));

import {afterCommit, notifyReservationWatchers, notifySalesWatchers} from "../salesStaffNotify";

const companyId = new ObjectId();
const otherCompany = new ObjectId();

function user(overrides: Partial<FixtureUser> = {}): FixtureUser {
    const _id = new ObjectId();
    return {_id, username: `${_id}@example.com`, name: "Ann", surname: "Lee", companies: [companyId], isActive: true, ...overrides};
}

const saleInput = {
    companyId,
    companyName: "Acme",
    languageCode: "en-US",
    saleId: new ObjectId().toString(),
    pendingApproval: true,
    paymentType: "cash" as const,
    unitId: new ObjectId().toString(),
    unitNumber: "A-101",
};

describe("notifySalesWatchers", () => {
    beforeEach(() => {
        mocks.users = [];
        mocks.getNotificationRecipients.mockReset();
        mocks.emit.mockReset();
        mocks.sendMail.mockReset().mockResolvedValue(undefined);
    });

    it("does nothing when no sale watchers are configured", async () => {
        mocks.getNotificationRecipients.mockResolvedValue({notifyOnSales: [], notifyOnReservations: []});
        await expect(notifySalesWatchers(saleInput)).resolves.toBe(0);
        expect(mocks.emit).not.toHaveBeenCalled();
        expect(mocks.sendMail).not.toHaveBeenCalled();
    });

    it("alerts active company members only, once in-app and once by email each", async () => {
        const a = user();
        const b = user({name: "Bo", surname: "Ng"});
        const inactive = user({isActive: false});
        const foreign = user({companies: [otherCompany]});
        const buyer = user({name: "Buyer", surname: "One", companies: [otherCompany]});
        mocks.users = [a, b, inactive, foreign, buyer];
        mocks.getNotificationRecipients.mockResolvedValue({
            notifyOnSales: [a, b, inactive, foreign].map(u => u._id.toString()),
            notifyOnReservations: [],
        });

        await expect(notifySalesWatchers({...saleInput, buyerId: buyer._id.toString()})).resolves.toBe(2);

        expect(mocks.emit).toHaveBeenCalledTimes(1);
        const [code, event] = mocks.emit.mock.calls[0];
        expect(code).toBe("SALE_CREATED_STAFF");
        expect(event.receiverIds.sort()).toEqual([a, b].map(u => u._id.toString()).sort());
        expect(event.payload).toMatchObject({pendingApproval: true, unitNumber: "A-101", buyerName: "Buyer One"});

        expect(mocks.sendMail).toHaveBeenCalledTimes(2);
        expect(mocks.sendMail.mock.calls.map(([m]) => m.email).sort()).toEqual([a.username, b.username].sort());
        expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({kind: "sale_created", pendingApproval: true, buyerName: "Buyer One"});
    });

    it("keeps emailing the others when one email fails, and never throws", async () => {
        const a = user();
        const b = user();
        mocks.users = [a, b];
        mocks.getNotificationRecipients.mockResolvedValue({notifyOnSales: [a, b].map(u => u._id.toString()), notifyOnReservations: []});
        mocks.sendMail.mockRejectedValueOnce(new Error("smtp down"));
        const err = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(notifySalesWatchers(saleInput)).resolves.toBe(2);
        expect(mocks.sendMail).toHaveBeenCalledTimes(2);
        err.mockRestore();
    });
});

describe("notifyReservationWatchers", () => {
    beforeEach(() => {
        mocks.users = [];
        mocks.emit.mockReset();
        mocks.sendMail.mockReset().mockResolvedValue(undefined);
    });

    it("uses the reservation list, not the sales list", async () => {
        const salesOnly = user();
        const resWatcher = user();
        mocks.users = [salesOnly, resWatcher];
        mocks.getNotificationRecipients.mockResolvedValue({
            notifyOnSales: [salesOnly._id.toString()],
            notifyOnReservations: [resWatcher._id.toString()],
        });

        await notifyReservationWatchers({
            companyId,
            companyName: "Acme",
            languageCode: "en-US",
            reservationId: new ObjectId().toString(),
            unitId: new ObjectId().toString(),
            unitNumber: "B-2",
        });

        expect(mocks.emit).toHaveBeenCalledWith("RESERVATION_CREATED_STAFF", expect.objectContaining({receiverIds: [resWatcher._id.toString()]}));
        expect(mocks.sendMail).toHaveBeenCalledTimes(1);
        expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({kind: "reservation_created", email: resWatcher.username});
    });
});

describe("afterCommit", () => {
    function fakeSession(committed: boolean) {
        return Object.assign(new EventEmitter(), {transaction: {isCommitted: committed}}) as any;
    }

    it("runs only after the session ends with a committed transaction", () => {
        const fn = vi.fn().mockResolvedValue(undefined);
        const session = fakeSession(true);
        afterCommit(session, fn);
        expect(fn).not.toHaveBeenCalled();
        session.emit("ended", session);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("skips when the transaction was rolled back", () => {
        const fn = vi.fn().mockResolvedValue(undefined);
        const session = fakeSession(false);
        afterCommit(session, fn);
        session.emit("ended", session);
        expect(fn).not.toHaveBeenCalled();
    });

    it("runs immediately without a session", () => {
        const fn = vi.fn().mockResolvedValue(undefined);
        afterCommit(undefined, fn);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
