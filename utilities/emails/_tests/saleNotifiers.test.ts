import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({sendMail: vi.fn()}));

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: mocks.sendMail}));
vi.mock("../reservationContractAttachment", () => ({tryLoadReservationContractForEmail: vi.fn().mockResolvedValue(null)}));

import {sendSaleClientMail} from "../saleNotifiers";
import type {SaleClientEmailEvent} from "../../../kafka/types";

const event: SaleClientEmailEvent = {
    eventType: "sale_client_email",
    email: "buyer@example.com",
    userId: "u1",
    fullName: "Bob",
    languageCode: "en-US",
    timestamp: 0,
    kind: "sale_created",
    companyId: "c1",
    companyName: "Acme",
    saleId: "s1",
    paymentType: "payment_plan",
    unitNumber: "A-101",
    downPaymentDisplay: "20 €",
    downPaymentPaid: true,
    numberOfInstallments: 2,
    paymentSchedule: [
        {installmentNumber: 1, dueDate: "Jan 1, 2027", amount: "50 €"},
        {installmentNumber: 2, dueDate: "Feb 1, 2027", amount: "50 €"},
    ],
};

describe("sendSaleClientMail – sale created", () => {
    beforeEach(() => mocks.sendMail.mockReset().mockResolvedValue(undefined));

    for (const languageCode of ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"]) {
        it(`renders the payment plan table (${languageCode})`, async () => {
            await sendSaleClientMail({...event, languageCode});
            const [, mail] = mocks.sendMail.mock.calls[0];
            expect(mail.html).toContain("Feb 1, 2027");
            expect(mail.html).toContain("#2");
            expect(mail.html).not.toMatch(/\{[a-zA-Z]+\}/);
        });
    }

    it("omits the table for cash sales", async () => {
        await sendSaleClientMail({...event, paymentType: "cash"});
        const [, mail] = mocks.sendMail.mock.calls[0];
        expect(mail.html).not.toContain("Payment schedule");
    });
});
