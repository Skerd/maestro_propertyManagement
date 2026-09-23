import {Schema} from "mongoose";

export function applyAdCampaignIndexes(schema: Schema): void {
    schema.index({name: 1}, {unique: true});

    // The dispatch cron's claim: due `scheduled` rows and in-flight `sending` ones.
    schema.index({company: 1, status: 1, scheduledAt: 1});

    // The list page's default ordering, filtered by type.
    schema.index({company: 1, campaignType: 1, createdAt: -1});
}
