import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({sendMail: vi.fn()}));

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: mocks.sendMail}));

import {
    renderAdCampaignEmail,
    sendAdCampaignMail,
    type RenderAdCampaignInput,
} from "../adCampaignNotifier";

const base: RenderAdCampaignInput = {
    bodyHtml: "<p>Hello {firstName}, see {projectName}.</p>",
    subject: "News from {companyName}",
    previewText: "A quick update",
    languageCode: "en-US",
    companyName: "Acme & Co",
    fullName: "Ann <Lee>",
    tokens: {firstName: "Ann", projectName: "Riverside & Co"},
    unsubscribeUrl: "https://site.example/unsubscribe?token=abc",
    preferencesUrl: "https://site.example/unsubscribe?token=abc&manage=1",
};

describe("renderAdCampaignEmail", () => {
    it("substitutes tokens in the body", () => {
        const {html} = renderAdCampaignEmail(base);
        expect(html).toContain("Hello Ann");
        expect(html).not.toContain("{firstName}");
    });

    it("HTML-escapes token values in the body", () => {
        const {html} = renderAdCampaignEmail(base);
        // "Riverside & Co" must not land as a raw ampersand inside markup.
        expect(html).toContain("Riverside &amp; Co");
    });

    it("does NOT escape the subject, which mail clients render as text", () => {
        const {subject} = renderAdCampaignEmail(base);
        expect(subject).toBe("News from Acme & Co");
        expect(subject).not.toContain("&amp;");
    });

    it("cannot be injected through a token value", () => {
        const {html} = renderAdCampaignEmail({
            ...base,
            bodyHtml: "<p>{firstName}</p>",
            tokens: {firstName: `<img src=x onerror="alert(1)">`},
        });
        // The word "onerror" does still appear — as inert escaped *text*. What
        // must not exist is a live element carrying it as an attribute.
        expect(html).not.toMatch(/<img[^>]*onerror/i);
        expect(html).toContain("&lt;img");
    });

    it("sanitizes author markup", () => {
        const {html} = renderAdCampaignEmail({
            ...base,
            bodyHtml: `<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>`,
        });
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/javascript:alert/i);
        expect(html).toContain("<p>ok</p>");
    });

    describe("the unsubscribe footer", () => {
        it("is present even when the body uses no unsubscribe token", () => {
            // The whole point: an author cannot ship a campaign without one.
            const {html} = renderAdCampaignEmail({...base, bodyHtml: "<p>no link here</p>"});
            expect(html).toContain(base.unsubscribeUrl);
            // `&` inside an href must be written `&amp;` — that is correct HTML,
            // and mail clients parse it back to `&` when the link is followed.
            expect(html).toContain(base.preferencesUrl.replace(/&/g, "&amp;"));
            expect(html).toContain("Unsubscribe");
        });

        it("is present in every supported locale", () => {
            for (const languageCode of ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"]) {
                const {html} = renderAdCampaignEmail({...base, languageCode, bodyHtml: "<p>x</p>"});
                expect(html, languageCode).toContain(base.unsubscribeUrl);
            }
        });

        it("still renders when the author also places a link in the body", () => {
            const {html} = renderAdCampaignEmail({
                ...base,
                bodyHtml: `<p><a href="{unsubscribeUrl}">opt out</a></p>`,
            });
            // Once in the body, once in the footer.
            const occurrences = html.split(base.unsubscribeUrl).length - 1;
            expect(occurrences).toBeGreaterThanOrEqual(2);
        });
    });

    describe("locale handling", () => {
        it("uses the requested locale's copy", () => {
            const de = renderAdCampaignEmail({...base, languageCode: "de-CH"});
            expect(de.html).toContain("Abmelden");
            expect(de.html).toContain('lang="de"');
        });

        it("falls back to en-US for an unsupported language", () => {
            const zz = renderAdCampaignEmail({...base, languageCode: "zz-ZZ"});
            expect(zz.html).toContain("Unsubscribe");
        });
    });

    it("reports known tokens that had no value", () => {
        const {unresolvedPlaceholders} = renderAdCampaignEmail({
            ...base,
            bodyHtml: "<p>{firstName} {offerTitle}</p>",
            tokens: {firstName: "Ann"},
        });
        expect(unresolvedPlaceholders).toContain("offerTitle");
        expect(unresolvedPlaceholders).not.toContain("firstName");
    });

    it("mirrors the subject as the visible heading", () => {
        const {html, subject} = renderAdCampaignEmail(base);
        // Escaped in the heading slot, raw in the subject line.
        expect(html).toContain("News from Acme &amp; Co");
        expect(subject).toBe("News from Acme & Co");
    });
});

describe("sendAdCampaignMail", () => {
    beforeEach(() => {
        mocks.sendMail.mockReset();
    });

    it("sends through the shared transport by default", async () => {
        await sendAdCampaignMail({...base, email: "a@b.com", companyId: "c1"});
        expect(mocks.sendMail).toHaveBeenCalledTimes(1);
        const [companyId, opts] = mocks.sendMail.mock.calls[0];
        expect(companyId).toBe("c1");
        expect(opts.to).toBe("a@b.com");
        expect(opts.subject).toBe("News from Acme & Co");
    });

    describe("RFC 8058 headers", () => {
        const oneClickUrl = "https://api.example/api/realEstate/adCampaignUnsubscribe/oneClick?token=abc";

        it("advertises one-click when a POST-able endpoint is configured", async () => {
            await sendAdCampaignMail({...base, email: "a@b.com", companyId: "c1", oneClickUrl});
            const [, opts] = mocks.sendMail.mock.calls[0];
            // The POST endpoint comes first; the human-facing page is the fallback.
            expect(opts.headers["List-Unsubscribe"]).toBe(`<${oneClickUrl}>, <${base.unsubscribeUrl}>`);
            expect(opts.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
        });

        it("omits the one-click header when no endpoint is configured", async () => {
            // Advertising one-click and then serving a GET-only page breaks the
            // contract with the providers that actually check it, so the header
            // is dropped rather than pointed at the landing page.
            await sendAdCampaignMail({...base, email: "a@b.com", companyId: "c1"});
            const [, opts] = mocks.sendMail.mock.calls[0];
            expect(opts.headers["List-Unsubscribe"]).toBe(`<${base.unsubscribeUrl}>`);
            expect(opts.headers["List-Unsubscribe-Post"]).toBeUndefined();
        });
    });

    it("prefers an injected pooled sender and returns its message id", async () => {
        const send = vi.fn().mockResolvedValue({messageId: "<abc@host>"});
        const result = await sendAdCampaignMail({...base, email: "a@b.com", companyId: "c1", send});
        expect(send).toHaveBeenCalledTimes(1);
        // The pooled session replaces the per-message transport entirely.
        expect(mocks.sendMail).not.toHaveBeenCalled();
        expect(result.messageId).toBe("<abc@host>");
    });

    it("passes the sender overrides through", async () => {
        await sendAdCampaignMail({
            ...base,
            email: "a@b.com",
            companyId: "c1",
            fromName: "Acme Sales",
            replyTo: "sales@acme.example",
        });
        const [, opts] = mocks.sendMail.mock.calls[0];
        expect(opts.fromName).toBe("Acme Sales");
        expect(opts.replyTo).toBe("sales@acme.example");
    });
});
