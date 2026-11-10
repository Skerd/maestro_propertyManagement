/** TD-B171: a sale client email goes to Kafka, and through SMTP only when the publish does not go through. */
import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const mocks = vi.hoisted(() => ({
    findById: vi.fn(),
    publish: vi.fn(),
    sendMail: vi.fn(),
}));

vi.mock("@coreModule/database/schemas/user/user.service", () => ({userService: {findById: mocks.findById}}));
vi.mock("@propertyManagement/kafka/kafkaProducer", () => ({publishSaleClientEmailEvent: mocks.publish}));
vi.mock("@propertyManagement/utilities/emails/saleNotifiers", () => ({sendSaleClientMail: mocks.sendMail}));

import {dispatchSaleClientEmail, type DispatchSaleClientEmailInput} from "@propertyManagement/utilities/database/sale/saleClientEmailDispatch";

const buyerId = new ObjectId();
const input: DispatchSaleClientEmailInput = {
    clientUserId: buyerId,
    languageCode: "en-US",
    kind: "sale_created",
    companyId: new ObjectId().toString(),
    companyName: "Riverside Homes",
    saleId: new ObjectId().toString(),
    paymentType: "cash",
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({_id: buyerId, username: "ana@example.com", name: "Ana", surname: "Berisha"});
    mocks.sendMail.mockResolvedValue(undefined);
});

describe("dispatchSaleClientEmail (TD-B171)", () => {
    it("publishes to Kafka and does not send by SMTP when the publish goes through", async () => {
        mocks.publish.mockResolvedValue(true);
        expect(await dispatchSaleClientEmail(input)).toBe(true);
        expect(mocks.publish).toHaveBeenCalledTimes(1);
        expect(mocks.publish.mock.calls[0][0]).toMatchObject({
            eventType: "sale_client_email",
            email: "ana@example.com",
            userId: buyerId.toString(),
            fullName: "Ana Berisha",
            kind: "sale_created",
            saleId: input.saleId,
        });
        expect(mocks.publish.mock.calls[0][0]).not.toHaveProperty("clientUserId");
        expect(mocks.sendMail).not.toHaveBeenCalled();
    });

    it("sends the same event by SMTP when Kafka is unavailable or the publish fails", async () => {
        mocks.publish.mockResolvedValue(false);
        expect(await dispatchSaleClientEmail(input)).toBe(true);
        expect(mocks.sendMail).toHaveBeenCalledTimes(1);
        expect(mocks.sendMail).toHaveBeenCalledWith(mocks.publish.mock.calls[0][0]);
    });

    it("sends nothing when the buyer has no email", async () => {
        mocks.findById.mockResolvedValue({_id: buyerId, name: "Ana"});
        expect(await dispatchSaleClientEmail(input)).toBe(false);
        expect(mocks.publish).not.toHaveBeenCalled();
        expect(mocks.sendMail).not.toHaveBeenCalled();
    });
});
