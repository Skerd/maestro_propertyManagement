import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import AdCampaignRecipient, {IAdCampaignRecipient} from "./adCampaignRecipient";

export class AdCampaignRecipientService extends BaseCrudService<IAdCampaignRecipient, typeof AdCampaignRecipient> {
    constructor() {
        super(AdCampaignRecipient, "AdCampaignRecipient");
    }
}

export const adCampaignRecipientService = new AdCampaignRecipientService();
