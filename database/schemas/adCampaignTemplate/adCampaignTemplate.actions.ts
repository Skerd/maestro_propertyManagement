import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {getModelCollectedData} from "@coreModule/database/collections";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {previewAdCampaignTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/previewAdCampaignTemplate.form.validator";
import type {
    AdCampaignTemplate as AdCampaignTemplateDto,
    AdCampaignTemplatePreviewResponse,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/adCampaignTemplate.dto";
import {renderAdCampaignEmail} from "../../../utilities/emails/adCampaignNotifier";
import {
    AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
    adCampaignSampleTokens,
} from "../../../utilities/marketing/adCampaignSampleTokens";
import {adCampaignTemplateToDTO} from "../../../utilities/mappers/adCampaignTemplate/adCampaignTemplateMapper.dto";
import AdCampaign, {IAdCampaign} from "../adCampaign/adCampaign";
import AdCampaignTemplate from "./adCampaignTemplate";
import {adCampaignTemplateService} from "./adCampaignTemplate.service";

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

    /**
     * Put a template back in circulation.
     *
     * `active` is deliberately not on the create or edit form: flipping it
     * decides whether campaigns can still render this template, and burying
     * that in a form someone opened to fix a typo invites accidents. It is an
     * explicit, confirmed action instead — the same shape the other config
     * entities use.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async activate(params: Record<string, any>): Promise<AdCampaignTemplateDto> {
        return setActiveState(params, true);
    }

    /**
     * Retire a template without deleting it.
     *
     * Campaigns already sending keep their chosen row — `resolveForLocale`
     * rejects an inactive template, so the sender fails that recipient rather
     * than silently mailing something an operator pulled.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async deactivate(params: Record<string, any>): Promise<AdCampaignTemplateDto> {
        return setActiveState(params, false);
    }
}

async function setActiveState(params: Record<string, any>, active: boolean): Promise<AdCampaignTemplateDto> {
    const {logger, languageCode, session, company, actionUserCtx, _id} = params;

    const writeFields = SchemaGuard.sanitizeFields(
        AdCampaignTemplate,
        getModelCollectedData("adcampaigntemplates").writeFields!,
        "write",
        actionUserCtx,
        languageCode,
    );
    if (!writeFields.active) {
        throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
    }

    const existing = await adCampaignTemplateService.findOneOrThrow(
        {_id: new ObjectId(String(_id)), company: company._id},
        {session, logger, languageCode},
    );

    // Idempotent: the only way to land here is a stale menu, and re-confirming
    // the state someone already wanted is not an error worth a toast.
    if ((existing.active !== false) === active) {
        return adCampaignTemplateToDTO(existing);
    }

    const updated = await adCampaignTemplateService.updateByIdOrThrow(
        existing._id as ObjectId,
        {active},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );

    return adCampaignTemplateToDTO(updated);
}
