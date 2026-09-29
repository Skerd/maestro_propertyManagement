import type {AdCampaignSimple} from "armonia/src/modules/propertyManagement/dto/adCampaign.dto";
import type {IAdCampaign} from "@propertyManagement/database/schemas/adCampaign/adCampaign";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const AdCampaignSimpleSnippet = defineSnippet<IAdCampaign, AdCampaignSimple>()({
    keys: {
        _id: {},
        name: {},
        title: {},
        campaignType: {},
        status: {},
    },
});
