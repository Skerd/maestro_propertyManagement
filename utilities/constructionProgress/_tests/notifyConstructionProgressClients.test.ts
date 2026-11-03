import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const mocks = vi.hoisted(() => ({
    progress: null as any,
    recipients: vi.fn(),
    emit: vi.fn(),
    sendMail: vi.fn(),
    loadPhotos: vi.fn(),
    stamp: vi.fn(),
}));

vi.mock("@propertyManagement/database/schemas/constructionProgress/constructionProgress", () => ({
    default: {
        findById: () => ({populate: () => ({lean: async () => mocks.progress})}),
        updateOne: mocks.stamp,
    },
}));
vi.mock("@coreModule/database/schemas/company/company", () => ({
    default: {findById: () => ({select: () => ({lean: async () => ({name: "Acme"})})})},
}));
vi.mock("@coreModule/domain/notifications/notificationEventBus", () => ({emitNotificationEvent: mocks.emit}));
vi.mock("../constructionProgressRecipients", () => ({findConstructionProgressRecipients: mocks.recipients}));
vi.mock("@propertyManagement/utilities/emails/mediaImageAttachments", () => ({loadInlineImageAttachments: mocks.loadPhotos}));
vi.mock("@propertyManagement/utilities/emails/constructionProgressNotifiers", () => ({sendConstructionProgressClientMail: mocks.sendMail}));

import {notifyConstructionProgressClients} from "../notifyConstructionProgressClients";

const company = new ObjectId();
const project = new ObjectId();

function recipient(units: string[]) {
    const userId = new ObjectId().toString();
    return {userId, email: `${userId}@example.com`, fullName: "Ann Lee", units: units.map(u => ({unitId: u, unitNumber: u, relation: "buyer"}))};
}

describe("notifyConstructionProgressClients", () => {
    beforeEach(() => {
        mocks.progress = {
            _id: new ObjectId(), company, project: {_id: project, name: "Riverside"}, edifice: undefined,
            phase: "structure", progressPercent: 75, updateDate: new Date("2027-01-01"), title: "Roof", photos: [new ObjectId()],
        };
        for (const m of [mocks.recipients, mocks.emit, mocks.sendMail, mocks.loadPhotos, mocks.stamp]) m.mockReset();
        mocks.sendMail.mockResolvedValue(undefined);
        mocks.loadPhotos.mockResolvedValue([{filename: "a.jpg", content: Buffer.from("x"), contentType: "image/jpeg", cid: "site-1"}]);
    });

    it("notifies nobody and stamps nothing when no client is in scope", async () => {
        mocks.recipients.mockResolvedValue([]);
        await expect(notifyConstructionProgressClients(mocks.progress._id, {languageCode: "en-US"})).resolves.toBe(0);
        expect(mocks.emit).not.toHaveBeenCalled();
        expect(mocks.stamp).not.toHaveBeenCalled();
    });

    it("emits once, emails each client their own units with the shared photos, then stamps the report", async () => {
        const a = recipient(["A-1"]);
        const b = recipient(["B-1", "B-2"]);
        mocks.recipients.mockResolvedValue([a, b]);

        await expect(notifyConstructionProgressClients(mocks.progress._id, {languageCode: "sq-AL"})).resolves.toBe(2);

        expect(mocks.emit).toHaveBeenCalledTimes(1);
        const [code, event] = mocks.emit.mock.calls[0];
        expect(code).toBe("CONSTRUCTION_PROGRESS_UPDATE");
        expect(event.receiverIds).toEqual([a.userId, b.userId]);
        expect(event.payload.unitLabelsByUser[b.userId]).toEqual(["B-1", "B-2"]);

        expect(mocks.loadPhotos).toHaveBeenCalledTimes(1);
        expect(mocks.sendMail).toHaveBeenCalledTimes(2);
        expect(mocks.sendMail.mock.calls[1][0]).toMatchObject({
            email: b.email, unitLabels: ["B-1", "B-2"], projectName: "Riverside", companyName: "Acme",
            phase: "structure", progressPercent: 75, languageCode: "sq-AL",
        });
        expect(mocks.sendMail.mock.calls[0][0].photos).toBe(mocks.sendMail.mock.calls[1][0].photos);
        expect(mocks.stamp.mock.calls[0][1].$set.clientsNotifiedCount).toBe(2);
    });

    it("keeps going when one email fails and never throws", async () => {
        mocks.recipients.mockResolvedValue([recipient(["A-1"]), recipient(["A-2"])]);
        mocks.sendMail.mockRejectedValueOnce(new Error("smtp down"));
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(notifyConstructionProgressClients(mocks.progress._id, {languageCode: "en-US"})).resolves.toBe(2);
        expect(mocks.sendMail).toHaveBeenCalledTimes(2);

        mocks.recipients.mockRejectedValueOnce(new Error("db down"));
        await expect(notifyConstructionProgressClients(mocks.progress._id, {languageCode: "en-US"})).resolves.toBe(0);
        err.mockRestore();
    });
});
