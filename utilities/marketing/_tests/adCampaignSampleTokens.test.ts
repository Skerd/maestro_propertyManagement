import {describe, expect, it, vi} from "vitest";

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: vi.fn()}));

import {
    AD_CAMPAIGN_PLACEHOLDERS,
    AD_CAMPAIGN_TYPE_VALUES,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {renderAdCampaignEmail} from "../../emails/adCampaignNotifier";
import {
    AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
    adCampaignSampleTokens,
} from "../adCampaignSampleTokens";

/** A body that uses every known token exactly once. */
const everyTokenBody = AD_CAMPAIGN_PLACEHOLDERS.map(token => `<p>{${token}}</p>`).join("");

/** Tokens that only mean something for one campaign type. */
const TYPE_SPECIFIC: Record<string, readonly string[]> = {
    price_change: ["oldPrice", "newPrice", "priceChangePercent"],
    offer: ["offerTitle", "offerEndsAt"],
    new_project: [],
};

/** Every token a campaign of this type is expected to be able to resolve. */
function resolvableFor(campaignType: string): string[] {
    const foreign = new Set(
        Object.entries(TYPE_SPECIFIC)
            .filter(([type]) => type !== campaignType)
            .flatMap(([, tokens]) => tokens),
    );
    return AD_CAMPAIGN_PLACEHOLDERS.filter(token => !foreign.has(token));
}

function previewRender(campaignType: (typeof AD_CAMPAIGN_TYPE_VALUES)[number]) {
    return renderAdCampaignEmail({
        bodyHtml: everyTokenBody,
        subject: "{campaignTitle}",
        languageCode: "en-US",
        companyName: "Acme",
        fullName: "Ana Marku",
        tokens: adCampaignSampleTokens(campaignType, {companyName: "Acme", campaignTitle: "Spring"}),
        unsubscribeUrl: AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
        preferencesUrl: AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    });
}

describe("adCampaignSampleTokens", () => {
    /*
     * The invariant that matters: adding a token to AD_CAMPAIGN_PLACEHOLDERS
     * without a sample value would make the panel preview render it as an empty
     * string, which reads as a broken template — an author would then "fix" it
     * by deleting a token that resolves perfectly well for a real recipient.
     */
    for (const campaignType of AD_CAMPAIGN_TYPE_VALUES) {
        it(`resolves every placeholder that means something for ${campaignType}`, () => {
            const unresolved = previewRender(campaignType).unresolvedPlaceholders;
            const missing = resolvableFor(campaignType).filter(token => unresolved.includes(token));
            expect(missing).toEqual([]);
        });

        it(`leaves another type's placeholders unresolved in a ${campaignType} preview`, () => {
            // Not a gap: these really would ship blank, and the editor shows a
            // "no sample value for {token}" warning so the author sees it here
            // rather than in a few thousand inboxes.
            const unresolved = previewRender(campaignType).unresolvedPlaceholders;
            const foreign = Object.entries(TYPE_SPECIFIC)
                .filter(([type]) => type !== campaignType)
                .flatMap(([, tokens]) => tokens);
            expect(unresolved.sort()).toEqual([...foreign].sort());
        });
    }

    it("overlays campaign-specific values on the shared ones", () => {
        const priceChange = adCampaignSampleTokens("price_change");
        expect(priceChange.newPrice).toBeTruthy();
        expect(priceChange.offerTitle).toBeUndefined();

        const offer = adCampaignSampleTokens("offer");
        expect(offer.offerTitle).toBeTruthy();
        expect(offer.newPrice).toBeUndefined();
        // Shared values survive the overlay.
        expect(offer.firstName).toBe("Ana");
    });

    it("lets the caller override a sample value", () => {
        expect(adCampaignSampleTokens("offer", {companyName: "Acme"}).companyName).toBe("Acme");
    });

    it("never mints a working unsubscribe link", () => {
        // The preview is rendered for whoever opens the editor; a real signed
        // token here would be a live opt-out for an arbitrary address.
        expect(AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL).not.toMatch(/token=ey/);
        expect(AD_CAMPAIGN_PREVIEW_PREFERENCES_URL).not.toMatch(/token=ey/);
    });
});
