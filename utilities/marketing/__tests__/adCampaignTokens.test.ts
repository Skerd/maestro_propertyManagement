import {describe, expect, it, vi} from "vitest";

vi.mock("@coreModule/environment", () => ({
    clientHostFor: (app: string) => (app === "public" ? "https://vista.example" : ""),
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));

import {
    buildOpenProjectCtaUrl,
    formatOfferEndsAt,
    formatPriceChangePercent,
    previousPriceFromHistory,
    recipientIdentityTokens,
    throwIfUnresolved,
    AdCampaignTokenError,
} from "../adCampaignTokens";

describe("previousPriceFromHistory", () => {
    it("returns undefined when there is no previous change", () => {
        expect(previousPriceFromHistory(undefined)).toBeUndefined();
        expect(previousPriceFromHistory([])).toBeUndefined();
        expect(previousPriceFromHistory([{price: "100"}])).toBeUndefined();
    });

    it("uses the last-but-one entry after a price change was logged", () => {
        expect(previousPriceFromHistory([
            {price: "248000"},
            {price: "231000"},
        ])).toBe(248000);
    });
});

describe("formatPriceChangePercent", () => {
    it("formats a drop with a minus sign and one decimal", () => {
        expect(formatPriceChangePercent(248000, 231000)).toBe("-6.9%");
    });

    it("prefixes an increase with a plus", () => {
        expect(formatPriceChangePercent(100, 110)).toBe("+10.0%");
    });
});

describe("buildOpenProjectCtaUrl", () => {
    it("points at the public 3d project page", () => {
        expect(buildOpenProjectCtaUrl("abc")).toBe("https://vista.example/open-project/3d?projectId=abc");
    });

    it("adds unitId for a price-change deep link", () => {
        expect(buildOpenProjectCtaUrl("abc", "unit1")).toContain("unitId=unit1");
    });
});

describe("formatOfferEndsAt", () => {
    it("formats a calendar date in the requested locale", () => {
        const formatted = formatOfferEndsAt(new Date("2026-10-31T12:00:00.000Z"), "en-US");
        expect(formatted).toMatch(/2026/);
        expect(formatted).toMatch(/10|31/);
    });
});

describe("recipientIdentityTokens", () => {
    it("does not split fullName when first and last are stored", () => {
        const tokens = recipientIdentityTokens({
            firstName: "Ana",
            lastName: "Marku",
            fullName: "Ana Marku",
            email: "ana@x.com",
        });
        expect(tokens.firstName).toBe("Ana");
        expect(tokens.lastName).toBe("Marku");
        expect(tokens.fullName).toBe("Ana Marku");
    });

    it("builds fullName from the parts when it is missing", () => {
        const tokens = recipientIdentityTokens({
            firstName: "Ana",
            lastName: "Marku",
            email: "ana@x.com",
        });
        expect(tokens.fullName).toBe("Ana Marku");
    });
});

describe("throwIfUnresolved", () => {
    it("ignores unsubscribe tokens the shell always fills", () => {
        expect(() => throwIfUnresolved(["unsubscribeUrl", "preferencesUrl"])).not.toThrow();
    });

    it("refuses leftover content tokens", () => {
        expect(() => throwIfUnresolved(["offerTitle"])).toThrow(AdCampaignTokenError);
    });
});
