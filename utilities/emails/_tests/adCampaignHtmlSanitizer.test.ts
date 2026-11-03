import {describe, expect, it} from "vitest";
import {sanitizeAdCampaignHtml} from "../adCampaignHtmlSanitizer";

describe("sanitizeAdCampaignHtml", () => {
    describe("strips what can execute", () => {
        it("removes script tags and discards their body", () => {
            const out = sanitizeAdCampaignHtml(`<p>hi</p><script>alert(1)</script>`);
            expect(out).not.toMatch(/script/i);
            // `discard`, not `escape` — an escaped body would show up as
            // visible text in the email.
            expect(out).not.toMatch(/alert/i);
            expect(out).toBe("<p>hi</p>");
        });

        it("removes inline event handlers but keeps the element", () => {
            expect(sanitizeAdCampaignHtml(`<p onclick="alert(1)">hi</p>`)).toBe("<p>hi</p>");
            expect(sanitizeAdCampaignHtml(`<img src="https://x/a.png" onerror="alert(1)">`)).not.toMatch(/onerror/i);
        });

        it("removes javascript: and vbscript: hrefs but keeps the link text", () => {
            expect(sanitizeAdCampaignHtml(`<a href="javascript:alert(1)">x</a>`)).toBe("<a>x</a>");
            expect(sanitizeAdCampaignHtml(`<a href="vbscript:msgbox">x</a>`)).not.toMatch(/vbscript/i);
        });

        it("removes iframe, object, embed, form and svg outright", () => {
            expect(sanitizeAdCampaignHtml(`<p>a</p><iframe src="https://evil"></iframe>`)).toBe("<p>a</p>");
            expect(sanitizeAdCampaignHtml(`<object data="x"></object>`)).toBe("");
            expect(sanitizeAdCampaignHtml(`<embed src="x">`)).toBe("");
            expect(sanitizeAdCampaignHtml(`<form action="https://evil"><input name="pw"></form>`)).toBe("");
            expect(sanitizeAdCampaignHtml(`<svg onload="alert(1)"><circle/></svg>`)).toBe("");
        });

        it("rejects a data: image source", () => {
            expect(sanitizeAdCampaignHtml(`<img src="data:text/html;base64,PHNjcmlwdD4=">`)).not.toMatch(/data:/i);
        });
    });

    describe("dangerous CSS", () => {
        it("drops the offending declaration and keeps its siblings", () => {
            const out = sanitizeAdCampaignHtml(`<p style="width:expression(alert(1));color:red">hi</p>`);
            expect(out).not.toMatch(/expression/i);
            // The whole declaration goes, not just the matched token — otherwise
            // `width:alert(1))` would be left behind as garbage.
            expect(out).not.toMatch(/alert/i);
            expect(out).toContain("color:red");
        });

        it("drops the style attribute entirely when nothing safe is left", () => {
            const out = sanitizeAdCampaignHtml(`<p style="behavior:url(#x)">hi</p>`);
            expect(out).toBe("<p>hi</p>");
        });

        it("is not stateful across calls", () => {
            const input = `<p style="width:expression(a);color:red">x</p>`;
            // A `g`-flagged regex with `.test()` would alternate pass/fail here
            // as `lastIndex` advanced.
            expect(sanitizeAdCampaignHtml(input)).toBe(sanitizeAdCampaignHtml(input));
        });
    });

    describe("keeps what email needs", () => {
        it("preserves table layout markup and its attributes", () => {
            const input = `<table width="100%" cellpadding="0" bgcolor="#fff"><tr><td align="center" style="padding:10px">x</td></tr></table>`;
            const out = sanitizeAdCampaignHtml(input);
            expect(out).toContain("<table");
            expect(out).toContain(`width="100%"`);
            expect(out).toContain(`bgcolor="#fff"`);
            expect(out).toContain(`align="center"`);
            expect(out).toContain("padding:10px");
        });

        it("preserves cid:, https: and mailto: references", () => {
            expect(sanitizeAdCampaignHtml(`<img src="cid:hero1" alt="x">`)).toContain("cid:hero1");
            expect(sanitizeAdCampaignHtml(`<a href="https://ok.example">go</a>`)).toContain("https://ok.example");
            expect(sanitizeAdCampaignHtml(`<a href="mailto:a@b.com">m</a>`)).toContain("mailto:a@b.com");
        });

        it("adds rel=noopener to links that open a new window", () => {
            const out = sanitizeAdCampaignHtml(`<a href="https://ok.example" target="_blank">go</a>`);
            expect(out).toContain(`rel="noopener noreferrer"`);
        });
    });

    describe("placeholder tokens survive", () => {
        // If the sanitizer mangled these, every campaign would ship with dead
        // links — including the unsubscribe link, which is a compliance problem.
        it("survive in text content", () => {
            expect(sanitizeAdCampaignHtml(`<p>Hello {firstName}, {unitList}</p>`))
                .toBe("<p>Hello {firstName}, {unitList}</p>");
        });

        it("survive inside href, which parses as a relative URL", () => {
            expect(sanitizeAdCampaignHtml(`<a href="{ctaUrl}">Click</a>`)).toContain("{ctaUrl}");
            expect(sanitizeAdCampaignHtml(`<a href="{unsubscribeUrl}">u</a>`)).toContain("{unsubscribeUrl}");
            expect(sanitizeAdCampaignHtml(`<a href="{preferencesUrl}">p</a>`)).toContain("{preferencesUrl}");
        });

        it("survive alongside an inline style", () => {
            const out = sanitizeAdCampaignHtml(`<a href="{unsubscribeUrl}" style="color:#b8873a">Unsubscribe</a>`);
            expect(out).toContain("{unsubscribeUrl}");
            expect(out).toContain("color:#b8873a");
        });
    });

    describe("empty input", () => {
        it("normalizes nothing-ish values to an empty string", () => {
            // Lets callers treat "no override" and "blank override" identically.
            expect(sanitizeAdCampaignHtml("")).toBe("");
            expect(sanitizeAdCampaignHtml(null)).toBe("");
            expect(sanitizeAdCampaignHtml(undefined)).toBe("");
            expect(sanitizeAdCampaignHtml(123 as never)).toBe("");
        });
    });

    describe("idempotence", () => {
        it("sanitizing twice equals sanitizing once", () => {
            // The sanitizer runs on write and again on render, so a second pass
            // must not degrade already-clean markup.
            const input = `<table width="100%"><tr><td style="padding:8px"><a href="{ctaUrl}" target="_blank">go</a><img src="cid:a" alt="b"></td></tr></table>`;
            const once = sanitizeAdCampaignHtml(input);
            expect(sanitizeAdCampaignHtml(once)).toBe(once);
        });
    });
});
