import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import AdCampaignRecipient, {IAdCampaignRecipient} from "./adCampaignRecipient";
import type {FilterQuery} from "mongoose";
import type {ObjectId} from "mongodb";

export class AdCampaignRecipientService extends BaseCrudService<IAdCampaignRecipient, typeof AdCampaignRecipient> {
    constructor() {
        super(AdCampaignRecipient, "AdCampaignRecipient");
    }

    /** The ids of the next pending recipients, oldest first. */
    findPendingIds(filter: FilterQuery<IAdCampaignRecipient>, batchSize: number) {
        return this.model.find(filter).noDeleted()
            .sort({_id: 1})
            .limit(batchSize)
            .select("_id")
            .lean<{_id: ObjectId}[]>();
    }

    /** The recipients claimed with one token, as plain objects. */
    findByClaimTokenLean(claimToken: ObjectId) {
        return this.model.find({claimToken}).lean<IAdCampaignRecipient[]>();
    }

    /** Inserts recipient rows, skipping duplicates of the unique index instead of stopping at the first. */
    insertSkippingDuplicates(rows: Record<string, unknown>[]) {
        return this.model.insertMany(rows, {ordered: false});
    }
}

export const adCampaignRecipientService = new AdCampaignRecipientService();
