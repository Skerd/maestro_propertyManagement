import {Schema} from "mongoose";

export function applyAdCampaignTemplateIndexes(schema: Schema): void {
    // The natural key. Locale siblings of one template share a name, so the
    // locale is part of the uniqueness — "Spring offer / offer / de-CH" and
    // "Spring offer / offer / en-US" are two rows of the same template.
    schema.index(
        {company: 1, name: 1, campaignType: 1, locale: 1},
        {unique: true, partialFilterExpression: {deletedAt: null}},
    );

    // The send-time lookup: type + locale, active rows only.
    schema.index({company: 1, campaignType: 1, locale: 1, active: 1});
}
