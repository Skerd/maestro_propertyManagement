import {Schema} from "mongoose";

export function applyMarketingPreferenceIndexes(schema: Schema): void {
    // One row per address per tenant. Consent is per-tenant on purpose: a buyer
    // of two developers must be able to opt out of one without silencing the
    // other, which a flag on the shared core `User` could not express.
    schema.index({company: 1, email: 1}, {unique: true, partialFilterExpression: {deletedAt: null}});

    // Back-reference lookups from the panel.
    schema.index({company: 1, user: 1}, {sparse: true});
    schema.index({company: 1, lead: 1}, {sparse: true});
}
