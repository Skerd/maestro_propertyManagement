import {Schema} from "mongoose";

export function applyAdCampaignRecipientIndexes(schema: Schema): void {
    // The dedupe key, and what makes materialization idempotent.
    //
    // Rows are hard-scoped to one campaign, so no company term is needed. The
    // email is what unifies a Lead and a client User who share an address —
    // without this, someone who enquired through the website and later bought a
    // unit would get the same campaign twice.
    //
    // No partial filter on `deletedAt`: a soft-deleted row must still block a
    // re-insert, or re-materializing a campaign would resurrect duplicates.
    schema.index({campaign: 1, email: 1}, {unique: true});

    // The batch claim: oldest pending rows of one campaign.
    schema.index({campaign: 1, status: 1, _id: 1});

    // The reclaim cron: rows left `queued` by a worker that died.
    schema.index({status: 1, claimedAt: 1});

    // Reading back the rows one worker just won.
    schema.index({claimToken: 1}, {sparse: true});

    // Send-time preference re-check, and the panel's "has this address ever
    // been mailed" lookup.
    schema.index({company: 1, email: 1});
}
