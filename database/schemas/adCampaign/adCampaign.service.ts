import {ObjectId} from "mongodb";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import {
    AD_CAMPAIGN_ERROR_MAX,
    type AdCampaignStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import AdCampaignRecipient from "@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient";
import AdCampaign, {IAdCampaign, IAdCampaignStats} from "./adCampaign";
import type {ClientSession, FilterQuery} from "mongoose";

/** Statuses a campaign may be edited or re-queued from. */
const EDITABLE_STATUSES: readonly AdCampaignStatus[] = ["draft", "scheduled", "paused", "failed"];

export class AdCampaignService extends BaseCrudService<IAdCampaign, typeof AdCampaign> {
    constructor() {
        super(AdCampaign, "AdCampaign");
    }

    /** Whether an operator may still change this campaign's content or audience. */
    isEditable(status: AdCampaignStatus): boolean {
        return EDITABLE_STATUSES.includes(status);
    }

    /**
     * Count the recipient rows per status and write the result onto the campaign.
     *
     * This is the authoritative number. The drain keeps `stats` roughly current
     * with `$inc` for cheap live display, but concurrent workers and a crash
     * mid-batch can both skew a counter, so every terminal transition recounts
     * rather than trusting what accumulated.
     */
    async recomputeStats(campaignId: ObjectId, company: ObjectId): Promise<IAdCampaignStats> {
        const rows = await AdCampaignRecipient.aggregate<{_id: string; count: number}>([
            {$match: {campaign: campaignId, company, deletedAt: null}},
            {$group: {_id: "$status", count: {$sum: 1}}},
        ]);

        const byStatus = new Map(rows.map(r => [r._id, r.count]));
        const get = (s: string) => byStatus.get(s) ?? 0;

        const stats: IAdCampaignStats = {
            // `queued` rows are in flight, not finished — count them as pending so
            // the numbers always add up to `total`.
            pending: get("pending") + get("queued"),
            sent: get("sent"),
            failed: get("failed"),
            skipped: get("skipped") + get("suppressed"),
            total: 0,
        };
        stats.total = stats.pending + stats.sent + stats.failed + stats.skipped;

        await AdCampaign.updateOne({_id: campaignId, company}, {$set: {stats}});
        return stats;
    }

    /** Move a campaign to a terminal or paused state, recounting first. */
    async finalize(
        campaignId: ObjectId,
        company: ObjectId,
        status: AdCampaignStatus,
        lastError?: string,
    ): Promise<void> {
        await this.recomputeStats(campaignId, company);
        await AdCampaign.updateOne(
            {_id: campaignId, company},
            {
                $set: {
                    status,
                    ...(status === "completed" ? {completedAt: new Date()} : {}),
                    ...(lastError ? {lastError: lastError.slice(0, AD_CAMPAIGN_ERROR_MAX)} : {}),
                },
                $unset: {claimToken: ""},
            },
        );
    }

    /** Marks the next due campaign of the company as sending and returns it (scheduled first), as a plain object. */
    claimDue(company: ObjectId, now: Date) {
        return this.model.findOneAndUpdate(
            {
                company,
                $or: [
                    {status: "scheduled", scheduledAt: {$lte: now}},
                    {status: "sending"},
                ],
            },
            {$set: {status: "sending", lastError: null}, $setOnInsert: {}},
            {new: true, sort: {scheduledAt: 1, createdAt: 1}},
        ).noDeleted().lean<IAdCampaign>();
    }

    /** A campaign's status, as a plain object. */
    findStatusLean(filter: FilterQuery<IAdCampaign>) {
        return this.model.findOne(filter).select("status").lean<{status: string}>();
    }

    /** The matching campaign, as a plain object. */
    findOneLean(filter: FilterQuery<IAdCampaign>, session?: ClientSession) {
        return this.model.findOne(filter).session(session ?? null).lean<IAdCampaign>();
    }

    /** The ids of the matching campaigns, as plain objects. */
    findIdsLean(filter: FilterQuery<IAdCampaign>) {
        return this.model.find(filter).noDeleted()
            .select("_id")
            .lean<{_id: any}[]>();
    }
}

export const adCampaignService = new AdCampaignService();
