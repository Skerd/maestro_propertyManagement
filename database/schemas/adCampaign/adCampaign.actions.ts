import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {AdCampaign as AdCampaignDto} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.dto";
import type {AdCampaignLocale} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {materializeAdCampaignRecipients} from "@propertyManagement/utilities/marketing/adCampaignAudience";
import {bulkSendBlockedReason, adCampaignSendConfig, effectiveRecipient} from "@propertyManagement/utilities/adCampaign/adCampaignConfig";
import {
    AdCampaignTokenError,
    assertTokensFillTemplate,
    mergeCampaignTokens,
    recipientIdentityTokens,
    resolveCampaignContentTokens,
} from "@propertyManagement/utilities/marketing/adCampaignTokens";
import type {AdCampaignTokenValues} from "@propertyManagement/utilities/emails/adCampaignNotifier";
import {adCampaignTemplateService} from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate.service";
import {sendAdCampaignMail, resolveRecipientLocale} from "@propertyManagement/utilities/emails/adCampaignNotifier";
import {buildUnsubscribeUrls} from "@propertyManagement/utilities/marketing/unsubscribeLinks";
import User from "@coreModule/database/schemas/user/user";
import {adCampaignToDTO} from "../../../utilities/mappers/adCampaign/adCampaignMapper.dto";
import AdCampaign, {IAdCampaign} from "./adCampaign";
import {adCampaignService} from "./adCampaign.service";

async function loadOwned(params: Record<string, any>): Promise<IAdCampaign> {
    const {_id, company, languageCode} = params;
    // An unparseable id is functionally the same as a missing campaign, and
    // reusing the key avoids inventing a second message for one condition.
    if (!_id || !ObjectId.isValid(String(_id))) {
        throw apiValidationException("ad_campaign_not_found", "_id", null, languageCode);
    }
    const campaign = await AdCampaign.findOne({_id: new ObjectId(String(_id)), company: company._id})
        .lean<IAdCampaign>();
    if (!campaign) {
        throw apiValidationException("ad_campaign_not_found", "_id", null, languageCode);
    }
    return campaign;
}

async function reloadDto(id: ObjectId, company: ObjectId): Promise<AdCampaignDto> {
    const fresh = await AdCampaign.findOne({_id: id, company}).lean<IAdCampaign>();
    return adCampaignToDTO(fresh!);
}

function rethrowTokenError(err: unknown, languageCode: string): never {
    if (err instanceof AdCampaignTokenError) {
        throw apiValidationException(err.exceptionKey, err.field ?? "campaignType", null, languageCode);
    }
    if (err instanceof Error && err.message.startsWith("ad_campaign_")) {
        throw apiValidationException(err.message, "campaignType", null, languageCode);
    }
    throw err;
}

async function assertCampaignContentReady(
    campaign: IAdCampaign,
    company: {_id: ObjectId; name?: string},
    languageCode: string,
): Promise<void> {
    try {
        const companyName = typeof company.name === "string" ? company.name : "";
        const contentTokens = await resolveCampaignContentTokens({
            campaign,
            company: company._id,
            languageCode,
            companyName,
        });
        const locale = resolveRecipientLocale(languageCode) as AdCampaignLocale;
        const template = await adCampaignTemplateService.resolveForLocale({
            company: company._id,
            templateId: campaign.template as unknown as ObjectId,
            locale,
        });
        if (!template) {
            throw apiValidationException("adCampaignTemplate_not_found", "template", null, languageCode);
        }
        assertTokensFillTemplate({
            bodyHtml: campaign.bodyHtmlOverride || template.bodyHtml,
            subject: campaign.subjectOverride || template.subject,
            previewText: template.previewText,
            languageCode: locale,
            companyName,
            tokens: contentTokens,
        });
    } catch (err) {
        rethrowTokenError(err, languageCode);
    }
}

export class AdCampaignActions {
    /**
     * Resolve the audience and hand the campaign to the dispatcher.
     *
     * Gated by the model's **create** permission rather than plain write.
     * Everything else under Tenancy → Configurations is low-risk reference
     * data; this is the one config entity whose button emails thousands of
     * clients, and "may edit a draft" should not imply "may send it".
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        transaction: true,
    })
    async sendNow(params: Record<string, any>): Promise<AdCampaignDto> {
        const {logger, company, languageCode, actionUserCtx} = params;
        SchemaGuard.checkModelPermission(AdCampaign, "create", actionUserCtx, languageCode);

        const blocked = bulkSendBlockedReason();
        if (blocked) {
            throw apiValidationException("ad_campaign_send_disabled", "status", null, languageCode);
        }

        const campaign = await loadOwned(params);
        if (!adCampaignService.isEditable(campaign.status)) {
            throw apiValidationException("ad_campaign_not_editable", "status", null, languageCode);
        }

        await assertCampaignContentReady(campaign, company, languageCode);

        const id = campaign._id as ObjectId;
        logger.start(`Materializing audience for campaign ${id}...`);
        const result = await materializeAdCampaignRecipients(id, company._id, logger);
        if (result.pending === 0) {
            await AdCampaign.updateOne(
                {_id: id, company: company._id},
                {$set: {status: campaign.status}},
            );
            throw apiValidationException("ad_campaign_empty_audience", "audienceMode", null, languageCode);
        }

        // A future `scheduledAt` parks the campaign for the dispatch cron to
        // pick up at the right moment; otherwise it starts on the next tick.
        const startsLater = campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now();
        await AdCampaign.updateOne(
            {_id: id, company: company._id},
            {$set: {status: startsLater ? "scheduled" : "sending", lastError: null}},
        );

        logger.finish(`Campaign ${id} queued: ${result.pending} to send, ${result.suppressed} suppressed`);
        return reloadDto(id, company._id);
    }

    /** Stop between batches. Rows already claimed are freed by the reclaim cron. */
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}})
    async pause(params: Record<string, any>): Promise<AdCampaignDto> {
        const {company, languageCode} = params;
        const campaign = await loadOwned(params);
        if (campaign.status !== "sending" && campaign.status !== "scheduled") {
            throw apiValidationException("ad_campaign_not_pausable", "status", null, languageCode);
        }
        const id = campaign._id as ObjectId;
        await adCampaignService.finalize(id, company._id, "paused");
        return reloadDto(id, company._id);
    }

    /** Resume a paused campaign; its recipient rows are still there. */
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}})
    async resume(params: Record<string, any>): Promise<AdCampaignDto> {
        const {company, languageCode, actionUserCtx} = params;
        SchemaGuard.checkModelPermission(AdCampaign, "create", actionUserCtx, languageCode);

        const campaign = await loadOwned(params);
        if (campaign.status !== "paused") {
            throw apiValidationException("ad_campaign_not_resumable", "status", null, languageCode);
        }
        const id = campaign._id as ObjectId;
        await AdCampaign.updateOne({_id: id, company: company._id}, {$set: {status: "sending", lastError: null}});
        return reloadDto(id, company._id);
    }

    /** Give up on a campaign for good. Already-sent mail obviously stays sent. */
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}})
    async cancel(params: Record<string, any>): Promise<AdCampaignDto> {
        const {company, languageCode} = params;
        const campaign = await loadOwned(params);
        if (campaign.status === "completed" || campaign.status === "cancelled") {
            throw apiValidationException("ad_campaign_already_finished", "status", null, languageCode);
        }
        const id = campaign._id as ObjectId;
        await adCampaignService.finalize(id, company._id, "cancelled");
        return reloadDto(id, company._id);
    }

    /**
     * Resolve the audience without sending, so an operator can see the real
     * reach — and how many are suppressed — before committing.
     */
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 20}, transaction: true})
    async previewAudience(params: Record<string, any>): Promise<{total: number; pending: number; suppressed: number}> {
        const {company, logger, languageCode} = params;
        const campaign = await loadOwned(params);
        if (!adCampaignService.isEditable(campaign.status)) {
            throw apiValidationException("ad_campaign_not_editable", "status", null, languageCode);
        }
        const result = await materializeAdCampaignRecipients(campaign._id as ObjectId, company._id, logger);
        // Materializing leaves the campaign in `materializing`; put it back so
        // a preview is not mistaken for a queued send.
        await AdCampaign.updateOne(
            {_id: campaign._id, company: company._id},
            {$set: {status: campaign.status}},
        );
        return result;
    }

    /**
     * Send one live-token mail to the operator. Same non-prod guard as bulk send.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        schema: validateSingleForm,
    })
    async testSend(params: Record<string, any>): Promise<AdCampaignDto> {
        const {company, languageCode, actionUserCtx} = params;
        SchemaGuard.checkModelPermission(AdCampaign, "create", actionUserCtx, languageCode);

        const blocked = bulkSendBlockedReason();
        if (blocked) {
            throw apiValidationException("ad_campaign_send_disabled", "status", null, languageCode);
        }

        const campaign = await loadOwned(params);
        const operator = await User.findById(actionUserCtx.userId)
            .select("username name surname fullName")
            .lean<{username?: string; name?: string; surname?: string; fullName?: string}>();
        const operatorEmail = operator?.username?.trim();
        if (!operatorEmail) {
            throw apiValidationException("ad_campaign_test_send_no_operator_email", "email", null, languageCode);
        }

        const companyName = typeof company.name === "string" ? company.name : "";
        let contentTokens: AdCampaignTokenValues;
        try {
            contentTokens = await resolveCampaignContentTokens({
                campaign,
                company: company._id,
                languageCode,
                companyName,
            });
        } catch (err) {
            rethrowTokenError(err, languageCode);
        }

        const locale = resolveRecipientLocale(languageCode) as AdCampaignLocale;
        const template = await adCampaignTemplateService.resolveForLocale({
            company: company._id,
            templateId: campaign.template as unknown as ObjectId,
            locale,
        });
        if (!template) {
            throw apiValidationException("adCampaignTemplate_not_found", "template", null, languageCode);
        }

        const identity = recipientIdentityTokens({
            firstName: operator.name,
            lastName: operator.surname,
            fullName: operator.fullName || `${operator.name ?? ""} ${operator.surname ?? ""}`.trim() || undefined,
            email: operatorEmail,
        });
        const {unsubscribeUrl, preferencesUrl, oneClickUrl} = buildUnsubscribeUrls({
            companyId: company._id,
            email: operatorEmail,
            campaignId: campaign._id as ObjectId,
            campaignType: campaign.campaignType,
        });
        const config = adCampaignSendConfig();

        try {
            await sendAdCampaignMail({
                email: effectiveRecipient(operatorEmail, config),
                companyId: company._id.toString(),
                bodyHtml: campaign.bodyHtmlOverride || template.bodyHtml,
                subject: campaign.subjectOverride || template.subject,
                previewText: template.previewText,
                languageCode: locale,
                companyName,
                fullName: identity.fullName || operatorEmail,
                tokens: mergeCampaignTokens(contentTokens, identity),
                unsubscribeUrl,
                preferencesUrl,
                oneClickUrl,
                fromName: campaign.fromName,
                replyTo: campaign.replyTo,
            });
        } catch (err) {
            rethrowTokenError(err, languageCode);
        }

        return reloadDto(campaign._id as ObjectId, company._id);
    }
}
