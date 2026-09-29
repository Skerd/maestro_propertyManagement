import type {AdCampaignTemplateSimple} from "armonia/src/modules/propertyManagement/dto/adCampaignTemplate.dto";
import type {IAdCampaignTemplate} from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const AdCampaignTemplateSimpleSnippet = defineSnippet<IAdCampaignTemplate, AdCampaignTemplateSimple>()({
    keys: {
        _id: {},
        name: {},
        campaignType: {},
        locale: {},
    },
});
