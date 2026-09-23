import type {CronHandlerContext} from "@coreModule/cronjobs/registry/types";
import {runAdCampaignDispatch} from "@propertyManagement/utilities/adCampaign/adCampaignSender";

/**
 * Drains ad campaigns that are scheduled and due, or already mid-send.
 *
 * Jobs are seeded per company, so `ctx.company` is the tenant and every query
 * downstream is scoped to it.
 */
export async function runAdCampaignDispatchJob(ctx: CronHandlerContext): Promise<void> {
    await runAdCampaignDispatch({
        company: ctx.company as any,
        logger: ctx.logger as any,
        signal: ctx.signal as any,
        appendLog: ctx.appendLog,
    });
}
