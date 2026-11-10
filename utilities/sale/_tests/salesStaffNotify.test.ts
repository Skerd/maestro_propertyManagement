import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

type FixtureUser = {_id: ObjectId; username?: string; name?: string; surname?: string; companies: ObjectId[]; isActive: boolean; preferredLanguage?: string};

const mocks = vi.hoisted(() => ({
    users: [] as FixtureUser[],
    getNotificationRecipients: vi.fn(),
    emit: vi.fn(),
    sendMail: vi.fn(),
    /** Users who turned the notice off (D117). */
    muted: new Set<string>(),
}));

vi.mock("@coreModule/database/schemas/user/user", () => ({
    default: {
        // Mimics the Mongo filters the notifier relies on: _id $in, companies, and an active role entry for the company
        // (a fixture user's `isActive` stands for that entry).
        find: (query: {_id: {$in: ObjectId[]}; companies?: ObjectId; roles?: {$elemMatch: {company: ObjectId; active: string}}}) => {
            const ids = query._id.$in.map(String);
            const role = query.roles?.$elemMatch;
            const rows = mocks.users.filter(u =>
                ids.includes(String(u._id))
                && (query.companies == null || u.companies.some(c => String(c) === String(query.companies)))
                && (role == null || (u.isActive && u.companies.some(c => String(c) === String(role.company)))));
            return {select: () => ({lean: async () => rows, exec: async () => rows})};
        },
    },
}));
vi.mock("@coreModule/domain/notifications/notificationEventBus", () => ({emitNotificationEvent: mocks.emit}));
vi.mock("@coreModule/domain/notifications/notificationDomainService", () => ({
    filterUnmutedReceivers: async (ids: string[]) => ids.filter(id => !mocks.muted.has(id)),
}));
vi.mock("@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.service", () => ({
    propertyManagementConfigService: {getNotificationRecipients: mocks.getNotificationRecipients},
}));
vi.mock("@propertyManagement/utilities/emails/staffAlertNotifiers", () => ({sendSalesStaffAlertMail: mocks.sendMail}));

import {notifyReservationWatchers, notifySalesWatchers} from "../salesStaffNotify";
import {CONSTANTS} from "@coreModule/environment";

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
        mocks.muted.clear();
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

    it("does not email a watcher who turned the notice off; core skips their in-app notice (D117)", async () => {
        const a = user();
        const b = user();
        mocks.users = [a, b];
        mocks.muted.add(b._id.toString());
        mocks.getNotificationRecipients.mockResolvedValue({notifyOnSales: [a, b].map(u => u._id.toString()), notifyOnReservations: []});

        await expect(notifySalesWatchers(saleInput)).resolves.toBe(2);
        expect(mocks.emit.mock.calls[0][1].receiverIds.sort()).toEqual([a, b].map(u => u._id.toString()).sort());
        expect(mocks.sendMail.mock.calls.map(([m]) => m.email)).toEqual([a.username]);
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

// TD-B177: staff alerts were emailed in the language of the user whose action triggered them.
describe("staff alert language", () => {
    beforeEach(() => {
        mocks.users = [];
        mocks.muted.clear();
        mocks.emit.mockReset();
        mocks.sendMail.mockReset().mockResolvedValue(undefined);
    });

    it("writes each watcher's email in their own language, dates included", async () => {
        const swiss = user({preferredLanguage: "de-CH"});
        const french = user({preferredLanguage: "fr-FR"});
        mocks.users = [swiss, french];
        mocks.getNotificationRecipients.mockResolvedValue({notifyOnSales: [], notifyOnReservations: [swiss, french].map(u => u._id.toString())});

        await notifyReservationWatchers({
            companyId,
            companyName: "Acme",
            languageCode: "sq-AL",
            reservationId: new ObjectId().toString(),
            unitId: new ObjectId().toString(),
            expirationDate: "2027-03-15",
        });

        expect(mocks.emit.mock.calls[0][1].payload.languageCode).toBe("sq-AL");
        const byEmail = new Map(mocks.sendMail.mock.calls.map(([mail]) => [mail.email, mail]));
        expect(byEmail.get(swiss.username)).toMatchObject({languageCode: "de-CH"});
        expect(byEmail.get(french.username)).toMatchObject({languageCode: "fr-FR"});
        expect(byEmail.get(swiss.username)?.expirationDateFormatted).not.toBe(byEmail.get(french.username)?.expirationDateFormatted);
    });

    it("uses the instance default for a watcher who never picked a language", async () => {
        const unset = user();
        mocks.users = [unset];
        mocks.getNotificationRecipients.mockResolvedValue({notifyOnSales: [unset._id.toString()], notifyOnReservations: []});

        await notifySalesWatchers({...saleInput, languageCode: "sq-AL"});

        expect(mocks.sendMail.mock.calls[0][0].languageCode).toBe(CONSTANTS.DEFAULT_LANGUAGE ?? "en-US");
    });
});
