import type {
    AdCampaignType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import type {AdCampaignTokenValues} from "../emails/adCampaignNotifier";

/**
 * Stand-in values for the panel's live preview.
 *
 * Scoped to the campaign type on purpose. A `{newPrice}` in a `new_project`
 * campaign has nothing to resolve against and really will ship blank, so the
 * preview leaves it unresolved and the editor warns about it. Handing every
 * token a value regardless of type would paint over exactly the mistake the
 * preview exists to catch.
 *
 * The values are obviously fictional (`Ana Marku`, `vista.example`) so a
 * preview screenshot can never be mistaken for a real client's mail.
 */
const SHARED: AdCampaignTokenValues = {
    firstName: "Ana",
    lastName: "Marku",
    fullName: "Ana Marku",
    email: "ana.marku@example.com",
    projectName: "Lakeview Residences",
    projectNames: "Lakeview Residences, Parkside Gardens",
    unitList: "B-704, B-705",
    unitNumber: "B-704",
    ctaUrl: "https://vista.example/projects",
};

/** Values that only make sense for one campaign type. */
const BY_TYPE: Record<AdCampaignType, AdCampaignTokenValues> = {
    price_change: {
        oldPrice: "CHF 248'000.00",
        newPrice: "CHF 231'000.00",
        priceChangePercent: "-6.9%",
    },
    offer: {
        offerTitle: "Autumn completion offer",
        offerEndsAt: "31.10.2026",
    },
    new_project: {
        projectName: "Parkside Gardens",
    },
};

/**
 * Preview token values for a campaign type. `campaignTitle` and `companyName`
 * come from the real row being previewed, so the parts an author actually
 * controls are shown as they will ship.
 */
export function adCampaignSampleTokens(
    campaignType: AdCampaignType,
    overrides: AdCampaignTokenValues = {},
): AdCampaignTokenValues {
    return {...SHARED, ...BY_TYPE[campaignType], ...overrides};
}

/**
 * Preview unsubscribe links.
 *
 * Deliberately **not** real signed tokens: the preview is rendered for whoever
 * opens the editor, and minting a working opt-out link for an arbitrary address
 * into a panel response would be a live footgun. The footer still renders, so
 * an author sees exactly where it lands.
 */
export const AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL = "https://vista.example/unsubscribe?token=preview";
export const AD_CAMPAIGN_PREVIEW_PREFERENCES_URL = "https://vista.example/unsubscribe?token=preview&manage=1";
