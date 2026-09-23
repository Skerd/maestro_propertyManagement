import {ObjectId} from "mongodb";
import {createPooledMailSession, type PooledMailSession} from "@coreModule/utilities/emails/mailDeliveryService";
import {mapWithConcurrency} from "@coreModule/utilities/helpers/mapWithConcurrency";
import Company from "@coreModule/database/schemas/company/company";
import AdCampaign, {IAdCampaign} from "@propertyManagement/database/schemas/adCampaign/adCampaign";
import AdCampaignRecipient, {IAdCampaignRecipient} from "@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient";
import {adCampaignService} from "@propertyManagement/database/schemas/adCampaign/adCampaign.service";
import {adCampaignTemplateService} from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate.service";
import {marketingPreferenceService} from "@propertyManagement/database/schemas/marketingPreference/marketingPreference.service";
import {
    AD_CAMPAIGN_ERROR_MAX,
    AD_CAMPAIGN_MAX_ATTEMPTS,
    AD_CAMPAIGN_BATCH_SIZE_DEFAULT,
    type AdCampaignLocale,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {sendAdCampaignMail, resolveRecipientLocale} from "@propertyManagement/utilities/emails/adCampaignNotifier";
import {buildUnsubscribeUrls} from "@propertyManagement/utilities/marketing/unsubscribeLinks";
import {adCampaignSendConfig, bulkSendBlockedReason, effectiveRecipient} from "./adCampaignConfig";

export type SenderContext = {
    company: ObjectId;
    logger?: {info?: (m: string) => void; warn?: (m: string) => void; err?: (m: string) => void};
    signal?: {aborted: boolean};
    appendLog?: (line: string) => void;
};

function note(ctx: SenderContext, line: string): void {
    ctx.logger?.info?.(line);
    ctx.appendLog?.(line);
}

/**
 * Claim one campaign that is due to send.
 *
 * Re-claiming a campaign already in `sending` is deliberate and safe: the real
 * mutex is the per-recipient claim below, so a second worker joining a large
 * drain simply helps finish it.
 */
export async function claimDueCampaign(company: ObjectId): Promise<IAdCampaign | null> {
    const now = new Date();
    return AdCampaign.findOneAndUpdate(
        {
            company,
            deletedAt: null,
            $or: [
                {status: "scheduled", scheduledAt: {$lte: now}},
                {status: "sending"},
            ],
        },
        {$set: {status: "sending", lastError: null}, $setOnInsert: {}},
        {new: true, sort: {scheduledAt: 1, createdAt: 1}},
    ).lean<IAdCampaign>();
}

/**
 * Claim up to `batchSize` pending recipients for this worker.
 *
 * Three operations rather than one because `updateMany` has no `limit` and
 * `findOneAndUpdate` would cost a round trip per recipient — at 5 000 addresses
 * that is 5 000 round trips, which is what makes the swissOutreach orchestrator
 * unusable at volume.
 *
 * The `status: "pending"` guard inside the `updateMany` is what makes two
 * concurrent workers disjoint: each only wins the rows it actually flipped, and
 * reading back by `claimToken` returns exactly those.
 */
export async function claimRecipientBatch(
    campaignId: ObjectId,
    company: ObjectId,
    batchSize: number,
): Promise<IAdCampaignRecipient[]> {
    const candidates = await AdCampaignRecipient.find({
        campaign: campaignId,
        company,
        status: "pending",
        deletedAt: null,
    })
        .sort({_id: 1})
        .limit(batchSize)
        .select("_id")
        .lean<{_id: ObjectId}[]>();

    if (!candidates.length) return [];

    const claimToken = new ObjectId();
    await AdCampaignRecipient.updateMany(
        {_id: {$in: candidates.map(c => c._id)}, status: "pending"},
        {$set: {status: "queued", claimedAt: new Date(), claimToken}, $inc: {attempts: 1}},
    );

    return AdCampaignRecipient.find({claimToken}).lean<IAdCampaignRecipient[]>();
}

/** Whether the campaign should stop mid-drain (paused, cancelled, or shutting down). */
async function shouldStop(campaignId: ObjectId, company: ObjectId, ctx: SenderContext): Promise<boolean> {
    if (ctx.signal?.aborted) return true;
    const current = await AdCampaign.findOne({_id: campaignId, company}).select("status").lean<{status: string}>();
    return !current || current.status !== "sending";
}

/**
 * Send one batch and persist each outcome immediately.
 *
 * A failure returns the row to `pending` while attempts remain, so the next
 * tick retries it. Retrying across ticks rather than looping in-process means a
 * worker crash loses at most one attempt instead of stranding the row.
 */
async function sendBatch(
    campaign: IAdCampaign,
    company: ObjectId,
    batch: IAdCampaignRecipient[],
    session: PooledMailSession,
    ctx: SenderContext,
): Promise<{sent: number; failed: number; suppressed: number}> {
    const config = adCampaignSendConfig();
    const counts = {sent: 0, failed: 0, suppressed: 0};

    // Re-check consent right before rendering. Someone who unsubscribes from
    // batch 1's email must not still receive batch 40 — closing that window is
    // the entire point of the link, and filtering only at materialization
    // leaves it open for the whole drain.
    const states = await marketingPreferenceService.getStatesForEmails(
        company,
        batch.map(r => r.email),
    );

    const companyDoc = await Company.findById(company).select("name").lean<{name?: string}>();
    const companyName = companyDoc?.name ?? "";

    await mapWithConcurrency(batch, config.concurrency, async (row) => {
        if (!marketingPreferenceService.isAllowed(states.get(row.email), campaign.campaignType)) {
            await AdCampaignRecipient.updateOne(
                {_id: row._id},
                {$set: {status: "suppressed", skipReason: "opted_out"}, $unset: {claimToken: "", claimedAt: ""}},
            );
            counts.suppressed++;
            return;
        }

        try {
            const locale = resolveRecipientLocale(row.languageCode) as AdCampaignLocale;
            const template = await adCampaignTemplateService.resolveForLocale({
                company,
                templateId: campaign.template as unknown as ObjectId,
                locale,
            });
            if (!template) throw new Error("Campaign template is missing or inactive");

            const {unsubscribeUrl, preferencesUrl, oneClickUrl} = buildUnsubscribeUrls({
                companyId: company,
                email: row.email,
                campaignId: campaign._id as ObjectId,
                campaignType: campaign.campaignType,
            });

            const {messageId} = await sendAdCampaignMail({
                email: effectiveRecipient(row.email, config),
                companyId: company.toString(),
                bodyHtml: campaign.bodyHtmlOverride || template.bodyHtml,
                subject: campaign.subjectOverride || template.subject,
                previewText: template.previewText,
                languageCode: locale,
                companyName,
                fullName: row.fullName || row.email,
                tokens: {
                    firstName: (row.fullName ?? "").split(" ")[0] || undefined,
                    fullName: row.fullName || undefined,
                    email: row.email,
                    companyName,
                    campaignTitle: campaign.title,
                },
                unsubscribeUrl,
                preferencesUrl,
                oneClickUrl,
                fromName: campaign.fromName,
                replyTo: campaign.replyTo,
                send: session.send,
            });

            await AdCampaignRecipient.updateOne(
                {_id: row._id},
                {
                    $set: {status: "sent", sentAt: new Date(), messageId, lastError: null},
                    $unset: {claimToken: "", claimedAt: ""},
                },
            );
            counts.sent++;
        }
        catch (err: any) {
            const message = String(err?.message ?? err).slice(0, AD_CAMPAIGN_ERROR_MAX);
            const exhausted = (row.attempts ?? 1) >= AD_CAMPAIGN_MAX_ATTEMPTS;
            await AdCampaignRecipient.updateOne(
                {_id: row._id},
                {
                    $set: {status: exhausted ? "failed" : "pending", lastError: message},
                    $unset: {claimToken: "", claimedAt: ""},
                },
            );
            if (exhausted) counts.failed++;
            ctx.logger?.warn?.(`Campaign ${campaign._id} failed for ${row.email}: ${message}`);
        }
    });

    return counts;
}

/** Drain one campaign until it is finished, paused, cancelled or aborted. */
export async function drainCampaign(campaign: IAdCampaign, ctx: SenderContext): Promise<void> {
    const company = ctx.company;
    const campaignId = campaign._id as ObjectId;
    const batchSize = campaign.batchSize || AD_CAMPAIGN_BATCH_SIZE_DEFAULT;

    if (!campaign.startedAt) {
        await AdCampaign.updateOne({_id: campaignId, company}, {$set: {startedAt: new Date()}});
    }

    const session = await createPooledMailSession(company);
    try {
        while (true) {
            if (await shouldStop(campaignId, company, ctx)) {
                note(ctx, `Campaign ${campaignId} stopping early; queued rows will be reclaimed.`);
                return;
            }

            const batch = await claimRecipientBatch(campaignId, company, batchSize);
            if (!batch.length) break;

            const counts = await sendBatch(campaign, company, batch, session, ctx);
            await AdCampaign.updateOne(
                {_id: campaignId, company},
                {
                    $inc: {
                        "stats.sent": counts.sent,
                        "stats.failed": counts.failed,
                        "stats.skipped": counts.suppressed,
                        "stats.pending": -(counts.sent + counts.failed + counts.suppressed),
                    },
                },
            );
            note(ctx, `Campaign ${campaignId}: batch of ${batch.length} → ${counts.sent} sent, ${counts.failed} failed, ${counts.suppressed} suppressed`);
        }

        // Only complete once nothing is in flight — a row still `queued` belongs
        // to another worker, or to one that died and the reclaim cron will free.
        const outstanding = await AdCampaignRecipient.countDocuments({
            campaign: campaignId,
            company,
            status: {$in: ["pending", "queued"]},
            deletedAt: null,
        });
        if (outstanding === 0) {
            await adCampaignService.finalize(campaignId, company, "completed");
            note(ctx, `Campaign ${campaignId} completed.`);
        }
    }
    finally {
        await session.close();
    }
}

/** Cron entry point: drain every due campaign for this tenant. */
export async function runAdCampaignDispatch(ctx: SenderContext): Promise<void> {
    const blocked = bulkSendBlockedReason();
    if (blocked) {
        note(ctx, blocked);
        return;
    }

    while (!ctx.signal?.aborted) {
        const campaign = await claimDueCampaign(ctx.company);
        if (!campaign) return;

        try {
            await drainCampaign(campaign, ctx);
        }
        catch (err: any) {
            const message = String(err?.message ?? err);
            ctx.logger?.err?.(`Campaign ${campaign._id} drain failed: ${message}`);
            await adCampaignService.finalize(campaign._id as ObjectId, ctx.company, "failed", message);
        }
    }
}
