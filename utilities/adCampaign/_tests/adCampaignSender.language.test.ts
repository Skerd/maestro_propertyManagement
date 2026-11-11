/**
 * Each recipient gets the campaign in their own language (TD-B181): the template's version in that language, with the
 * prices and offer date formatted for it. A campaign with its own subject or body goes out in its template's language.
 */
import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const state = vi.hoisted(() => ({rows: [] as any[], claimed: false}));
const mocks = vi.hoisted(() => ({send: vi.fn(), tokens: vi.fn(), resolveForLocale: vi.fn(), findLocale: vi.fn()}));

vi.mock("@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient.service", () => ({
    adCampaignRecipientService: {
        // One batch with every row, then nothing left.
        findPendingIds: async () => (state.claimed ? [] : state.rows.map(r => ({_id: r._id}))),
        updateMany: async () => {
            state.claimed = true;
            return {matchedCount: state.rows.length, modifiedCount: state.rows.length};
        },
        findByClaimTokenLean: async () => state.rows.map(r => ({...r})),
        updateOne: async () => ({matchedCount: 1, modifiedCount: 1}),
        count: async () => 0,
    },
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({
    createPooledMailSession: async () => ({send: vi.fn(), close: async () => undefined}),
}));
vi.mock("@coreModule/database/schemas/company/company.service", () => ({companyService: {findById: async () => ({name: "Acme"})}}));
vi.mock("@propertyManagement/database/schemas/adCampaign/adCampaign.service", () => ({
    adCampaignService: {findStatusLean: async () => ({status: "sending"}), updateOne: vi.fn(), finalize: vi.fn(), claimDue: vi.fn()},
}));
vi.mock("@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate.service", () => ({
    adCampaignTemplateService: {resolveForLocale: mocks.resolveForLocale, findLocale: mocks.findLocale},
}));
vi.mock("@propertyManagement/database/schemas/marketingPreference/marketingPreference.service", () => ({
    marketingPreferenceService: {getStatesForEmails: async () => new Map(), isAllowed: () => true},
}));
vi.mock("@propertyManagement/utilities/emails/adCampaignNotifier", async (importOriginal) => ({
    ...await importOriginal<object>(),
    sendAdCampaignMail: mocks.send,
}));
vi.mock("@propertyManagement/utilities/marketing/unsubscribeLinks", () => ({buildUnsubscribeUrls: () => ({})}));
vi.mock("@propertyManagement/utilities/marketing/adCampaignTokens", async (importOriginal) => ({
    ...await importOriginal<object>(),
    resolveCampaignContentTokens: mocks.tokens,
}));

import {campaignRecipientLocale, contentTokensByLocale, drainCampaign} from "../adCampaignSender";
import AdCampaign, {type IAdCampaign} from "@propertyManagement/database/schemas/adCampaign/adCampaign";
import {AD_CAMPAIGN_TYPE_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";

const company = new ObjectId();
const row = (email: string, languageCode?: string) => ({_id: new ObjectId(), email, languageCode, status: "queued", attempts: 1});

/** A campaign document built by the model (never saved): only the fields the sender reads are set. */
function campaign(overrides: Partial<Pick<IAdCampaign, "subjectOverride" | "bodyHtmlOverride">> = {}): IAdCampaign {
    return new AdCampaign({company, template: new ObjectId(), campaignType: AD_CAMPAIGN_TYPE_VALUES[0], startedAt: new Date(), batchSize: 50, ...overrides});
}

beforeEach(() => {
    state.rows = [];
    state.claimed = false;
    mocks.send.mockReset().mockResolvedValue({messageId: "m"});
    mocks.tokens.mockReset().mockImplementation(async ({languageCode}: {languageCode: string}) => ({newPrice: `price@${languageCode}`}));
    mocks.resolveForLocale.mockReset().mockImplementation(async ({locale}: {locale: string}) => ({subject: `Subject ${locale}`, bodyHtml: `<p>${locale}</p>`}));
    mocks.findLocale.mockReset().mockResolvedValue("sq-AL");
});

describe("campaignRecipientLocale", () => {
    it("uses the recipient's language, narrowed to one the emails support", () => {
        expect(campaignRecipientLocale({}, "sq-AL", "de-CH")).toBe("de-CH");
        expect(campaignRecipientLocale({}, "sq-AL", "fr")).toBe("fr-FR");
    });

    it("sends a campaign with its own subject or body in its template's language", () => {
        expect(campaignRecipientLocale({subjectOverride: "Offer"}, "sq-AL", "de-CH")).toBe("sq-AL");
        expect(campaignRecipientLocale({bodyHtmlOverride: "<p>x</p>"}, "sq-AL", "de-CH")).toBe("sq-AL");
    });
});

describe("contentTokensByLocale", () => {
    it("formats the campaign's content once per language", async () => {
        const resolve = vi.fn(async (locale: string) => ({newPrice: locale}));
        const tokensFor = contentTokensByLocale(resolve);
        await Promise.all([tokensFor("de-CH"), tokensFor("de-CH"), tokensFor("fr-FR")]);
        expect(resolve.mock.calls.map(([locale]) => locale)).toEqual(["de-CH", "fr-FR"]);
    });
});

describe("drainCampaign language (TD-B181)", () => {
    it("writes each recipient's email in their language, with the template version and prices for it", async () => {
        state.rows = [row("ana@example.com", "de-CH"), row("bea@example.com", "fr-FR"), row("lead@example.com", undefined)];

        await drainCampaign(campaign(), {company});

        const sent = new Map(mocks.send.mock.calls.map(([mail]) => [mail.email, mail]));
        expect(sent.get("ana@example.com")).toMatchObject({languageCode: "de-CH", subject: "Subject de-CH", tokens: expect.objectContaining({newPrice: "price@de-CH"})});
        expect(sent.get("bea@example.com")).toMatchObject({languageCode: "fr-FR", subject: "Subject fr-FR", tokens: expect.objectContaining({newPrice: "price@fr-FR"})});
        expect(sent.get("lead@example.com")?.languageCode).toBeDefined();
    });

    it("sends a campaign with its own subject in its template's language to everyone", async () => {
        state.rows = [row("ana@example.com", "de-CH"), row("bea@example.com", "fr-FR")];

        await drainCampaign(campaign({subjectOverride: "Nur heute"}), {company});

        expect(mocks.send.mock.calls.map(([mail]) => mail.languageCode)).toEqual(["sq-AL", "sq-AL"]);
        expect(mocks.tokens.mock.calls.map(([input]) => input.languageCode)).toEqual(["sq-AL"]);
    });
});
