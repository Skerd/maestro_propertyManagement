import {ObjectId} from "mongodb";
import {clientHostFor} from "@coreModule/environment";
import {generateUnsubscribeToken} from "@coreModule/utilities/security/unsubscribeToken";
import {adCampaignSendConfig} from "@propertyManagement/utilities/adCampaign/adCampaignConfig";
import type {AdCampaignType} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";

/** Path of the public landing page, in the marketing app. */
export const UNSUBSCRIBE_PATH = "/unsubscribe";

export type UnsubscribeUrls = {
    /** One-click: lands and immediately opts out of this campaign's type. */
    unsubscribeUrl: string;
    /** Same page in manage mode: all toggles, nothing auto-changed. */
    preferencesUrl: string;
    /**
     * RFC 8058 endpoint mail providers POST to directly, or `""` when
     * `AD_CAMPAIGN_API_BASE_URL` is unset. Empty means the `List-Unsubscribe-Post`
     * header must be omitted: advertising one-click for a URL that only serves
     * GET breaks the contract with Gmail and Yahoo.
     */
    oneClickUrl: string;
};

/**
 * Build the pair of links that go in every campaign email.
 *
 * Both are plain GETs to the **sinfonia public app**, never to maestro:
 * Outlook SafeLinks, Proofpoint and friends fetch every link in a message, so a
 * mutating GET would unsubscribe people who never clicked. The landing page is
 * what issues the POST that actually changes anything.
 *
 * `clientHostFor("public")` returns `""` when `SINFONIA_CLIENT_URLS` has no
 * `public=` entry, which would ship every link relative and broken — check that
 * env var before any live send.
 */
export function buildUnsubscribeUrls(params: {
    companyId: ObjectId | string;
    email: string;
    campaignId?: ObjectId | string;
    campaignType?: AdCampaignType;
}): UnsubscribeUrls {
    const token = generateUnsubscribeToken({
        companyId: params.companyId,
        email: params.email,
        campaignId: params.campaignId,
        campaignType: params.campaignType,
    });

    const encoded = encodeURIComponent(token);
    const base = `${clientHostFor("public")}${UNSUBSCRIBE_PATH}?token=${encoded}`;
    const {apiBaseUrl} = adCampaignSendConfig();

    return {
        unsubscribeUrl: base,
        preferencesUrl: `${base}&manage=1`,
        oneClickUrl: apiBaseUrl
            ? `${apiBaseUrl}/api/realEstate/adCampaignUnsubscribe/oneClick?token=${encoded}`
            : "",
    };
}
