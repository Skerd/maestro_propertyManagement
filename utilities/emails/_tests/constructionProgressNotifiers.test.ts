import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({sendMail: vi.fn()}));

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: mocks.sendMail}));

import {progressBarHtml, sendConstructionProgressClientMail, type ConstructionProgressClientEmail} from "../constructionProgressNotifiers";

const base: ConstructionProgressClientEmail = {
    email: "client@example.com",
    fullName: "Ann <Lee>",
    languageCode: "en-US",
    companyId: "c1",
    companyName: "Acme & Co",
    projectName: "Riverside",
    edificeName: "Tower A",
    unitLabels: ["A-101", "A-102"],
    phase: "structure",
    progressPercent: 75,
    updateDateFormatted: "January 1, 2027",
    expectedCompletionFormatted: "June 1, 2028",
    title: "Structure done to floor 5",
    description: "Slab <5> poured.",
    photos: [{filename: "site.jpg", content: Buffer.from("img"), contentType: "image/jpeg", cid: "site-1-abc@arpeggio"}],
};

describe("sendConstructionProgressClientMail", () => {
    beforeEach(() => mocks.sendMail.mockReset().mockResolvedValue(undefined));

    for (const languageCode of ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"]) {
        it(`renders every placeholder and inlines photos (${languageCode})`, async () => {
            await sendConstructionProgressClientMail({...base, languageCode});
            const [companyId, mail] = mocks.sendMail.mock.calls[0];
            expect(companyId).toBe("c1");
            expect(mail.subject).toContain("75");
            expect(mail.subject).toContain("A-101, A-102");
            expect(mail.subject).not.toMatch(/\{[a-zA-Z]+\}/);
            expect(mail.html).not.toMatch(/\{[a-zA-Z]+\}/);
            expect(mail.html).toContain('src="cid:site-1-abc@arpeggio"');
            expect(mail.attachments).toEqual([expect.objectContaining({cid: "site-1-abc@arpeggio", filename: "site.jpg"})]);
            expect(mail.html).toContain("Ann &lt;Lee&gt;");
            expect(mail.html).toContain("Slab &lt;5&gt; poured.");
        });
    }

    it("uses translated phase names", async () => {
        await sendConstructionProgressClientMail({...base, languageCode: "sq-AL"});
        expect(mocks.sendMail.mock.calls[0][1].html).toContain("Karkasi");
    });

    it("omits the photo section without photos", async () => {
        await sendConstructionProgressClientMail({...base, photos: []});
        const [, mail] = mocks.sendMail.mock.calls[0];
        expect(mail.html).not.toContain("cid:");
        expect(mail.attachments).toEqual([]);
    });
});

describe("progressBarHtml", () => {
    it("clamps and renders filled/empty cells", () => {
        expect(progressBarHtml(75, "x")).toContain('width="75%"');
        expect(progressBarHtml(140, "x")).toContain('width="100%"');
        expect(progressBarHtml(-5, "x")).not.toContain('width="0%"');
    });
});
