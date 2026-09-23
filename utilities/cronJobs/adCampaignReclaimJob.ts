import type {CronHandlerContext} from "@coreModule/cronjobs/registry/types";
import AdCampaign from "@propertyManagement/database/schemas/adCampaign/adCampaign";
import AdCampaignRecipient from "@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient";
import {adCampaignService} from "@propertyManagement/database/schemas/adCampaign/adCampaign.service";
import {adCampaignSendConfig} from "@propertyManagement/utilities/adCampaign/adCampaignConfig";

/**
 * Frees work stranded by a worker that died mid-batch.
 *
 * Three kinds of wreckage:
 *   1. recipients left `queued` — a worker claimed them and never reported back;
 *   2. campaigns stuck in `materializing` — audience resolution died partway;
 *   3. campaigns still `sending` with nothing outstanding — the final
 *      completion write was lost.
 *
 * All three are safe to repair blindly: claims are idempotent, materialization
 * is idempotent thanks to the `{campaign, email}` unique index, and completion
 * recomputes its numbers from the rows.
 */
export async function runAdCampaignReclaimJob(ctx: CronHandlerContext): Promise<void> {
    const company = ctx.company as any;
    const {stuckAfterMinutes} = adCampaignSendConfig();
    const cutoff = new Date(Date.now() - stuckAfterMinutes * 60_000);

    const reclaimed = await AdCampaignRecipient.updateMany(
        {company, status: "queued", claimedAt: {$lt: cutoff}, deletedAt: null},
        {$set: {status: "pending"}, $unset: {claimToken: "", claimedAt: ""}},
    );
    if (reclaimed.modifiedCount) {
        ctx.appendLog?.(`Reclaimed ${reclaimed.modifiedCount} stuck recipient row(s).`);
    }

    const stalled = await AdCampaign.updateMany(
        {company, status: "materializing", updatedAt: {$lt: cutoff}, deletedAt: null},
        {$set: {status: "draft", lastError: "Materialization timed out and was reset."}},
    );
    if (stalled.modifiedCount) {
        ctx.appendLog?.(`Reset ${stalled.modifiedCount} stalled materialization(s).`);
    }

    const sending = await AdCampaign.find({
        company,
        status: "sending",
        updatedAt: {$lt: cutoff},
        deletedAt: null,
    })
        .select("_id")
        .lean<{_id: any}[]>();

    for (const campaign of sending) {
        const outstanding = await AdCampaignRecipient.countDocuments({
            campaign: campaign._id,
            company,
            status: {$in: ["pending", "queued"]},
            deletedAt: null,
        });
        if (outstanding === 0) {
            await adCampaignService.finalize(campaign._id, company, "completed");
            ctx.appendLog?.(`Campaign ${campaign._id} had no work left; marked completed.`);
        }
    }
}
