import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({sendMail: vi.fn()}));

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: mocks.sendMail}));

import {sendInquiryClientMail, type InquiryClientEmail} from "../inquiryNotifiers";

const base: InquiryClientEmail = {
    email: "visitor@example.com",
    fullName: "Ann <Lee>",
    languageCode: "en-US",
    companyId: "c1",
    companyName: "Acme & Co",
    projectName: "Riverside",
    unitNumber: "A-101",
    unitName: "Garden flat",
    accountUrl: "https://arpeggio.al/account",
};

describe("sendInquiryClientMail (D178)", () => {
    beforeEach(() => mocks.sendMail.mockReset().mockResolvedValue(undefined));

    it("confirms the inquiry to the visitor, names the property and links to the account on the portal", async () => {
        await sendInquiryClientMail(base);
        const [companyId, mail] = mocks.sendMail.mock.calls[0];
        expect(companyId).toBe("c1");
        expect(mail.to).toBe("visitor@example.com");
        expect(mail.subject).toBe("We received your inquiry — Acme & Co");
        expect(mail.html).toContain("Acme &amp; Co has received your inquiry about the property below");
        expect(mail.html).toContain("Riverside");
        expect(mail.html).toContain("A-101");
        expect(mail.html).toContain("Garden flat");
        expect(mail.html).toContain("Ann &lt;Lee&gt;");
        expect(mail.html).toContain('href="https://arpeggio.al/account"');
        expect(mail.html).toContain("your Arpeggio account");
    });

    it("words a general message without a property and without an empty summary", async () => {
        await sendInquiryClientMail({...base, projectName: undefined, unitNumber: undefined, unitName: undefined});
        const [, mail] = mocks.sendMail.mock.calls[0];
        expect(mail.html).toContain("Thank you for your message. Acme &amp; Co has received it");
        expect(mail.html).not.toContain("Your inquiry</td>");
    });

    for (const languageCode of ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"]) {
        it(`fills every placeholder (${languageCode})`, async () => {
            await sendInquiryClientMail({...base, languageCode});
            const [, mail] = mocks.sendMail.mock.calls[0];
            expect(mail.subject).toContain("Acme & Co");
            expect(mail.subject).not.toMatch(/\{[a-zA-Z]+\}/);
            expect(mail.html).not.toMatch(/\{[a-zA-Z]+\}/);
            expect(mail.html).toContain('href="https://arpeggio.al/account"');
        });
    }

    it("sends nothing while email is off", async () => {
        vi.resetModules();
        vi.doMock("@coreModule/environment", () => ({EMAIL: {ENABLED: false}, CONSTANTS: {}, CLIENT_SIDE: {}}));
        const {sendInquiryClientMail: send} = await import("../inquiryNotifiers");
        await send(base);
        expect(mocks.sendMail).not.toHaveBeenCalled();
    });
});
