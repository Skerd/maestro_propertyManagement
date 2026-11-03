import {describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: vi.fn()}));

import {
    AD_CAMPAIGN_SUBJECT_MAX,
    AD_CAMPAIGN_TYPE_VALUES,
    findUnknownPlaceholders,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {sanitizeAdCampaignHtml} from "@propertyManagement/utilities/emails/adCampaignHtmlSanitizer";
import {renderAdCampaignEmail} from "@propertyManagement/utilities/emails/adCampaignNotifier";
import {
    AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
    adCampaignSampleTokens,
} from "@propertyManagement/utilities/marketing/adCampaignSampleTokens";
import {adCampaignTemplatesSeed} from "../adCampaignTemplates.seed";

describe("shipped ad campaign templates", () => {
    it("ships exactly one template per campaign type, covering every type", () => {
        const byType = adCampaignTemplatesSeed.map(t => t.campaignType);
        expect(byType.sort()).toEqual([...AD_CAMPAIGN_TYPE_VALUES].sort());
        expect(new Set(byType).size).toBe(byType.length);
    });

    it("uses preserved, distinct, valid ObjectIds", () => {
        const ids = adCampaignTemplatesSeed.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(ObjectId.isValid(id)).toBe(true);
    });

    for (const template of adCampaignTemplatesSeed) {
        describe(template.name, () => {
            /*
             * The bodies are hand-written, and the sanitizer runs on every write.
             * If it is not a no-op the shipped default is silently altered — a
             * dropped attribute reads as a rendering bug months later, with
             * nothing pointing back at the seed.
             */
            it("survives sanitization unchanged", () => {
                expect(sanitizeAdCampaignHtml(template.bodyHtml)).toBe(template.bodyHtml);
            });

            it("uses only known placeholders", () => {
                expect(findUnknownPlaceholders(template.bodyHtml)).toEqual([]);
                expect(findUnknownPlaceholders(template.subject)).toEqual([]);
                expect(findUnknownPlaceholders(template.previewText)).toEqual([]);
            });

            it("keeps the subject and preview text within their limits", () => {
                expect(template.subject.length).toBeGreaterThan(0);
                expect(template.subject.length).toBeLessThanOrEqual(AD_CAMPAIGN_SUBJECT_MAX);
                expect(template.previewText.length).toBeLessThanOrEqual(AD_CAMPAIGN_SUBJECT_MAX);
            });

            /** Every token it uses must be one its own campaign type can fill. */
            it("resolves all of its own tokens against the sample values", () => {
                const rendered = renderAdCampaignEmail({
                    bodyHtml: template.bodyHtml,
                    subject: template.subject,
                    previewText: template.previewText,
                    languageCode: template.locale,
                    companyName: "Acme",
                    fullName: "Ana Marku",
                    tokens: adCampaignSampleTokens(template.campaignType, {
                        companyName: "Acme",
                        campaignTitle: "Spring",
                    }),
                    unsubscribeUrl: AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
                    preferencesUrl: AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
                });
                expect(rendered.unresolvedPlaceholders).toEqual([]);
            });

            /*
             * The shell already renders "Hello {fullName}," above the body. A
             * body that opens with its own greeting produces "Hello Ana Marku,
             * Hello Ana," — which every assertion here passed while the actual
             * email read as broken. Only rendering it and looking showed it.
             */
            it("does not repeat the greeting the shell already emits", () => {
                const rendered = renderAdCampaignEmail({
                    bodyHtml: template.bodyHtml,
                    subject: template.subject,
                    languageCode: template.locale,
                    companyName: "Acme",
                    fullName: "Ana Marku",
                    tokens: adCampaignSampleTokens(template.campaignType),
                    unsubscribeUrl: AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
                    preferencesUrl: AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
                });
                expect(rendered.html.match(/Hello /g) ?? []).toHaveLength(1);
            });

            it("carries an unsubscribe footer without authoring one", () => {
                // The shell emits it; a template must not need to remember to.
                expect(template.bodyHtml).not.toContain("{unsubscribeUrl}");
                const rendered = renderAdCampaignEmail({
                    bodyHtml: template.bodyHtml,
                    subject: template.subject,
                    languageCode: template.locale,
                    companyName: "Acme",
                    fullName: "Ana Marku",
                    tokens: adCampaignSampleTokens(template.campaignType),
                    unsubscribeUrl: AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
                    preferencesUrl: AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
                });
                expect(rendered.html).toContain(AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL);
            });
        });
    }
});
