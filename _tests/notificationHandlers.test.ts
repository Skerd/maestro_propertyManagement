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

const companyId = new ObjectId().toString();
const projectId = new ObjectId().toString();
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

describe("propertyDevelopment delivery notices (emitted with the permit payload shape)", () => {
    it.each([
        ["RFI_OPENED", "rfiId", "RFI opened", NotificationImportance.MEDIUM],
        ["RFI_ANSWERED", "rfiId", "RFI answered", NotificationImportance.MEDIUM],
        ["VARIATION_ORDER_APPROVED", "variationOrderId", "Variation order approved", NotificationImportance.HIGH],
        ["VARIATION_ORDER_REJECTED", "variationOrderId", "Variation order rejected", NotificationImportance.HIGH],
        ["BUDGET_APPROVED", "budgetId", "Budget approved", NotificationImportance.HIGH],
        ["PROGRESS_CLAIM_SUBMITTED", "progressClaimId", "Progress claim submitted", NotificationImportance.MEDIUM],
        ["SAFETY_INCIDENT_REPORTED", "safetyIncidentId", "Safety incident reported", NotificationImportance.HIGH],
    ])("%s notifies each receiver under the event's company, in its language", async (code, idKey, description, importance) => {
        const recordId = new ObjectId().toString();
        const sent = await deliver(code, {companyId, [idKey]: recordId, title: "Level 3 slab", projectId, languageCode: "de-CH"});

        expect(sent.map(({input}) => String(input.receiver)).sort()).toEqual([...receivers].sort());
        for (const {input, opts} of sent) {
            expect(input).toMatchObject({code, description, importance, category: NotificationCategory.COMPANY});
            expect(String(input.company)).toBe(companyId);
            expect(input.content).toEqual({[idKey]: recordId, title: "Level 3 slab", projectId});
            expect(opts).toEqual({languageCode: "de-CH"});
        }
    });
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
        }
    });
});
