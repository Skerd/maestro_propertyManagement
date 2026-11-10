import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import type {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";

const mocks = vi.hoisted(() => ({createAndPush: vi.fn<Parameters<typeof createAndPushNotification>, Promise<object>>()}));

// The notification itself is recorded, not stored or pushed.
vi.mock("@coreModule/domain/notifications/notificationDomainService", () => ({createAndPushNotification: mocks.createAndPush}));

import {notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationImportance} from "@coreModule/database/schemas/notification/notification";
import {NotificationCategory} from "armonia/src/modules/core/api/user/private/notifications/notifications.enum";
import {registerRealEstateNotificationEventHandlers} from "@propertyManagement/domain/notifications/realEstateNotificationHandlers";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";

const companyId = new ObjectId().toString();
const receivers = [new ObjectId().toString(), new ObjectId().toString()];

/** Emits the way `emitNotificationEvent` publishes, and waits for the async handler to finish. */
async function deliver(code: string, payload: Record<string, unknown>) {
    notificationEventBus.emit(code, {code, receiverIds: receivers, payload});
    await vi.waitFor(() => expect(mocks.createAndPush).toHaveBeenCalledTimes(receivers.length));
    return mocks.createAndPush.mock.calls.map(([input, opts]) => ({input, opts}));
}

beforeAll(() => {
    registerRealEstateNotificationEventHandlers();
});

beforeEach(() => {
    mocks.createAndPush.mockReset().mockResolvedValue({});
});

describe("RESERVATION_EXPIRED (D112)", () => {
    it("tells each receiver which unit and client it was", async () => {
        const reservationId = new ObjectId().toString();
        const sent = await deliver("RESERVATION_EXPIRED", {
            companyId, reservationId, unitNumber: "A-101", clientName: "Ann Lee", agentName: "Bo Ng", expirationDate: "9 March 2026", languageCode: "en-US",
        });

        for (const {input} of sent) {
            expect(input).toMatchObject({
                code: "RESERVATION_EXPIRED",
                description: "Reservation expired: Unit A-101 (Ann Lee)",
                importance: NotificationImportance.HIGH,
                category: NotificationCategory.FINANCIAL,
            });
            expect(input.content).toMatchObject({reservationId, unitNumber: "A-101", clientName: "Ann Lee", agentName: "Bo Ng"});
            // The panel translates the code with these values (D117).
            expect(input.params).toEqual({unit: "A-101", client: "Ann Lee"});
        }
    });

    it("picks the variant without a client when there is none", async () => {
        const sent = await deliver("RESERVATION_EXPIRED", {companyId, reservationId: new ObjectId().toString(), unitNumber: "A-101", languageCode: "en-US"});
        expect(sent[0].input).toMatchObject({description: "Reservation expired: Unit A-101", params: {unit: "A-101", variant: "noClient"}});
    });
});

describe("every propertyManagement code (TD-B149)", () => {
    it("has exactly one handler", () => {
        for (const code of Object.values(NotificationEventCodes)) {
            expect(notificationEventBus.listenerCount(code), code).toBe(1);
        }
    });

    it.each([
        ["SALE_PENDING_APPROVAL", {unitNumber: "B-7"}, "Sale awaiting approval: Unit B-7", {unit: "B-7"}, NotificationImportance.MEDIUM],
        ["SALE_APPROVED", {decision: "approved"}, "Sale approved", {}, NotificationImportance.HIGH],
        ["SALE_REJECTED", {decision: "rejected", notes: "Price too low"}, "Sale rejected: Price too low", {notes: "Price too low"}, NotificationImportance.HIGH],
        ["COMMISSION_PENDING_APPROVAL", {amount: "1200.00", currencySymbol: "CHF"}, "Commission payment to approve: 1200.00 CHF", {amount: "1200.00 CHF"}, NotificationImportance.MEDIUM],
        ["COMMISSION_APPROVAL_REJECTED", {}, "Commission payment rejected", {variant: "noNotes"}, NotificationImportance.HIGH],
        ["MODIFICATION_REQUEST_CLIENT_COST_PENDING", {title: "Kitchen", totalCost: "800", currencySymbol: "EUR"}, "Cost to approve: 800 EUR", {title: "Kitchen", cost: "800 EUR"}, NotificationImportance.MEDIUM],
        ["MODIFICATION_REQUEST_CLIENT_COST_APPROVED", {title: "Kitchen"}, "Modification cost approved", {title: "Kitchen"}, NotificationImportance.MEDIUM],
        ["MODIFICATION_REQUEST_CLIENT_COST_REJECTED", {title: "Kitchen"}, "Modification cost declined", {title: "Kitchen"}, NotificationImportance.HIGH],
        ["MODIFICATION_REQUEST_REVISION_SUBMITTED", {title: "Kitchen"}, "Modification request revised and resubmitted", {title: "Kitchen"}, NotificationImportance.MEDIUM],
        ["MODIFICATION_REQUEST_REACTIVATED", {title: "Kitchen"}, "Modification request reactivated", {title: "Kitchen"}, NotificationImportance.MEDIUM],
        ["MODIFICATION_REQUEST_SLA_BREACHED", {title: "Kitchen"}, "Modification request overdue at its current stage", {title: "Kitchen"}, NotificationImportance.HIGH],
    ])("%s is delivered with its English fallback and message values", async (code, extra, description, params, importance) => {
        const sent = await deliver(code, {companyId, languageCode: "fr-FR", ...extra});
        for (const {input, opts} of sent) {
            expect(input).toMatchObject({code, description, params, importance});
            expect(opts).toEqual({languageCode: "fr-FR"});
        }
    });
});
