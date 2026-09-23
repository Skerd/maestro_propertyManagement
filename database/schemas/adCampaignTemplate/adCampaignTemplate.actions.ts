import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {previewAdCampaignTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/previewAdCampaignTemplate.form.validator";
import type {
    AdCampaignTemplatePreviewResponse,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/adCampaignTemplate.dto";
import {renderAdCampaignEmail} from "../../../utilities/emails/adCampaignNotifier";
import {
    AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
    adCampaignSampleTokens,
} from "../../../utilities/marketing/adCampaignSampleTokens";
import AdCampaign, {IAdCampaign} from "../adCampaign/adCampaign";

export class AdCampaignTemplateActions {
    /**
     * Render authored markup exactly as it will ship.
     *
     * Server-side on purpose. The panel could paste the body into an iframe
     * itself, but then the preview would skip the shell, the locale strings,
     * token substitution and — the part that matters — sanitization, so an
     * author would be approving something other than what goes out.
     *
     * Read-only: nothing here writes, and the campaign lookup is scoped to the
     * caller's company like every other query in this module.
     */
    @action({
        auth: "private",
        // Generous: the editor posts on a debounce while someone types.
        rateLimit: {windowMs: 60000, max: 120},
        schema: previewAdCampaignTemplateFormSchema,
    })
    async preview(params: Record<string, any>): Promise<AdCampaignTemplatePreviewResponse> {
        const {company, bodyHtml, subject, previewText, campaignType, locale, campaignId} = params;

        let campaign: IAdCampaign | null = null;
        if (campaignId && ObjectId.isValid(String(campaignId))) {
            campaign = await AdCampaign.findOne({_id: new ObjectId(String(campaignId)), company: company._id})
                .select("title campaignType")
                .lean<IAdCampaign>();
        }

        const companyName = typeof company.name === "string" ? company.name : "";
        const rendered = renderAdCampaignEmail({
            bodyHtml: typeof bodyHtml === "string" ? bodyHtml : "",
            subject: typeof subject === "string" ? subject : "",
            previewText: typeof previewText === "string" ? previewText : undefined,
            languageCode: locale,
            companyName,
            fullName: "Ana Marku",
            tokens: adCampaignSampleTokens(campaignType, {
                companyName,
                campaignTitle: campaign?.title ?? "",
            }),
            unsubscribeUrl: AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
            preferencesUrl: AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
        });

        return {
            html: rendered.html,
            subject: rendered.subject,
            unresolvedPlaceholders: rendered.unresolvedPlaceholders,
        };
    }
}
