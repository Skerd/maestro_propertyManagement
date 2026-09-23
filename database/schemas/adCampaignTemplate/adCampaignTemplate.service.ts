import {ObjectId} from "mongodb";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import type {
    AdCampaignLocale,
    AdCampaignType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import AdCampaignTemplate, {IAdCampaignTemplate} from "./adCampaignTemplate";

export class AdCampaignTemplateService extends BaseCrudService<IAdCampaignTemplate, typeof AdCampaignTemplate> {
    constructor() {
        super(AdCampaignTemplate, "AdCampaignTemplate");
    }

    /**
     * The template row to render for one recipient.
     *
     * Resolution order, so a partially translated template still sends:
     *   1. the chosen template's sibling in the recipient's locale
     *   2. the chosen row itself — the admin's explicit pick is a better
     *      fallback than a hardcoded `en-US`, which may not even exist
     *
     * Returns null only when the chosen template is gone or inactive, which the
     * caller treats as a per-recipient failure rather than killing the campaign.
     */
    async resolveForLocale(params: {
        company: ObjectId;
        templateId: ObjectId;
        locale: AdCampaignLocale;
    }): Promise<IAdCampaignTemplate | null> {
        const chosen = await AdCampaignTemplate.findOne({
            _id: params.templateId,
            company: params.company,
            active: true,
        }).lean<IAdCampaignTemplate>();
        if (!chosen) return null;

        if (chosen.locale === params.locale) return chosen;

        const sibling = await AdCampaignTemplate.findOne({
            company: params.company,
            name: chosen.name,
            campaignType: chosen.campaignType,
            locale: params.locale,
            active: true,
        }).lean<IAdCampaignTemplate>();

        return sibling ?? chosen;
    }

    /** The company's default template for a type, used to prefill the campaign form. */
    async findDefaultForType(company: ObjectId, campaignType: AdCampaignType): Promise<IAdCampaignTemplate | null> {
        return AdCampaignTemplate.findOne({
            company,
            campaignType,
            isDefault: true,
            active: true,
        }).lean<IAdCampaignTemplate>();
    }
}

export const adCampaignTemplateService = new AdCampaignTemplateService();
