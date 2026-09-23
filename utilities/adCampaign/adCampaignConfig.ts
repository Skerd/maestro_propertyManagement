import {SERVER} from "@coreModule/environment";

function boolEnv(key: string, fallback = false): boolean {
    const raw = process.env[key];
    if (raw == null || raw === "") return fallback;
    return raw.toLowerCase() === "true" || raw === "1";
}

function intEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type AdCampaignSendConfig = {
    /** How many messages a worker has in flight at once. */
    concurrency: number;
    /** Minutes after which a `queued` row is considered abandoned and reclaimed. */
    stuckAfterMinutes: number;
    /** Explicitly permits a real bulk send outside production. */
    allowNonProdSend: boolean;
    /** When set, every message is redirected here instead of the real recipient. */
    redirectAllTo: string;
    /**
     * Public origin of this API, e.g. `https://api.example.com`.
     *
     * Needed only for the RFC 8058 one-click endpoint, which mail providers
     * POST to directly. There is no platform-wide API URL in the environment,
     * and guessing one would be worse than omitting the header.
     */
    apiBaseUrl: string;
};

export function adCampaignSendConfig(): AdCampaignSendConfig {
    return {
        concurrency: intEnv("AD_CAMPAIGN_SEND_CONCURRENCY", 5),
        stuckAfterMinutes: intEnv("AD_CAMPAIGN_STUCK_AFTER_MINUTES", 15),
        allowNonProdSend: boolEnv("AD_CAMPAIGN_ALLOW_NONPROD_SEND"),
        redirectAllTo: (process.env.AD_CAMPAIGN_REDIRECT_ALL_TO || "").trim(),
        apiBaseUrl: (process.env.AD_CAMPAIGN_API_BASE_URL || "").trim().replace(/\/+$/, ""),
    };
}

export function isProduction(): boolean {
    return SERVER.NODE_ENV === "production";
}

/**
 * Whether a campaign may actually be drained here.
 *
 * A development database seeded with real client addresses plus one working
 * company SMTP row is all it takes to mail thousands of real buyers,
 * irreversibly, from a laptop. `EMAIL.ENABLED` alone does not protect against
 * that, because it is often on in dev so transactional mail can be tested.
 *
 * So bulk sending outside production is refused unless an operator has
 * explicitly opted in with `AD_CAMPAIGN_ALLOW_NONPROD_SEND=true`. Pair it with
 * `AD_CAMPAIGN_REDIRECT_ALL_TO` to route everything to one inbox.
 */
export function bulkSendBlockedReason(config: AdCampaignSendConfig = adCampaignSendConfig()): string | null {
    if (isProduction()) return null;
    if (config.allowNonProdSend) return null;
    return "Bulk campaign sending is disabled outside production. Set AD_CAMPAIGN_ALLOW_NONPROD_SEND=true (ideally with AD_CAMPAIGN_REDIRECT_ALL_TO) to allow it.";
}

/** The address a message should actually go to, honouring the dev redirect. */
export function effectiveRecipient(email: string, config: AdCampaignSendConfig = adCampaignSendConfig()): string {
    return config.redirectAllTo || email;
}
