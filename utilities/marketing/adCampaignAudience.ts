import {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import User from "@coreModule/database/schemas/user/user";
import Lead, {LeadStatus} from "@propertyManagement/database/schemas/lead/lead";
import AdCampaign, {IAdCampaign} from "@propertyManagement/database/schemas/adCampaign/adCampaign";
import AdCampaignRecipient from "@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient";
import {adCampaignService} from "@propertyManagement/database/schemas/adCampaign/adCampaign.service";
import {
    marketingPreferenceService,
    normalizeEmail,
} from "@propertyManagement/database/schemas/marketingPreference/marketingPreference.service";
import type {
    AdCampaignAudienceKind,
    AdCampaignSkipReason,
    AdCampaignType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {findClientHoldings} from "./clientAudience";

/** How many addresses to check preferences for in one query. */
const PREFERENCE_LOOKUP_CHUNK = 1000;
/** How many recipient rows to insert per `insertMany`. */
const INSERT_CHUNK = 1000;

export type AudienceCandidate = {
    email: string;
    audienceKind: AdCampaignAudienceKind;
    user?: ObjectId;
    lead?: ObjectId;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    languageCode: string;
    skipReason?: AdCampaignSkipReason;
};

export type UserLite = {
    _id: ObjectId;
    username?: string;
    name?: string;
    surname?: string;
    fullName?: string;
    isActive?: boolean;
};
export type LeadLite = {_id: ObjectId; email?: string; firstName?: string; lastName?: string};

/**
 * Recipient language.
 *
 * Core `User` stores no language or locale — `languageCode` only ever travels
 * as a request parameter — so there is nothing per-person to read. Everyone
 * therefore gets the platform default, and the template resolver falls back to
 * the campaign's chosen locale. Giving `User` a stored preference is the change
 * that would make per-recipient localization real.
 */
function defaultLanguage(): string {
    return CONSTANTS.DEFAULT_LANGUAGE || "en-US";
}

function displayName(u: UserLite): string | undefined {
    return u.fullName || `${u.name ?? ""} ${u.surname ?? ""}`.trim() || undefined;
}

function userIdentity(u: UserLite): Pick<AudienceCandidate, "firstName" | "lastName" | "fullName"> {
    const firstName = u.name?.trim() || undefined;
    const lastName = u.surname?.trim() || undefined;
    return {firstName, lastName, fullName: displayName(u)};
}

function skippedEmail(kind: "user" | "lead", id: ObjectId): string {
    return `skipped.${kind}.${id.toString()}@invalid.example`;
}

function refIds(list: unknown): ObjectId[] {
    if (!Array.isArray(list)) return [];
    const ids: ObjectId[] = [];
    for (const value of list) {
        if (value instanceof ObjectId) {
            ids.push(value);
            continue;
        }
        if (value && typeof value === "object" && "_id" in value) {
            const inner = (value as {_id: unknown})._id;
            if (inner instanceof ObjectId) ids.push(inner);
            else if (inner != null && ObjectId.isValid(String(inner))) ids.push(new ObjectId(String(inner)));
            continue;
        }
        if (value != null && ObjectId.isValid(String(value))) ids.push(new ObjectId(String(value)));
    }
    return ids;
}

/** Restrict `all`-mode leads to the campaign's project/unit scope. */
export function leadInterestFilter(projects: ObjectId[], units: ObjectId[]): Record<string, unknown> {
    if (units.length === 1) return {unitInterest: units[0]};
    if (units.length > 1) return {unitInterest: {$in: units}};
    if (projects.length === 1) return {projectInterest: projects[0]};
    if (projects.length > 1) return {projectInterest: {$in: projects}};
    return {};
}

export function toUserCandidate(u: UserLite, opts: {recordInactive: boolean}): AudienceCandidate | null {
    const identity = userIdentity(u);
    if (!u.username) {
        if (!opts.recordInactive) return null;
        return {
            email: skippedEmail("user", u._id),
            audienceKind: "user",
            user: u._id,
            ...identity,
            languageCode: defaultLanguage(),
            skipReason: "no_email",
        };
    }
    if (u.isActive === false) {
        if (!opts.recordInactive) return null;
        return {
            email: normalizeEmail(u.username),
            audienceKind: "user",
            user: u._id,
            ...identity,
            languageCode: defaultLanguage(),
            skipReason: "inactive",
        };
    }
    return {
        email: normalizeEmail(u.username),
        audienceKind: "user",
        user: u._id,
        ...identity,
        languageCode: defaultLanguage(),
    };
}

/** Client `User`s in scope, as campaign candidates. Email is `username`. */
async function clientUserCandidates(campaign: IAdCampaign, company: ObjectId): Promise<AudienceCandidate[]> {
    const {holdings} = await findClientHoldings({
        company,
        projects: refIds(campaign.projects),
        units: refIds(campaign.units),
    });
    if (!holdings.size) return [];

    const users = await User.find({
        _id: {$in: [...holdings.keys()].map(id => new ObjectId(id))},
        companies: company,
    })
        .select("_id username name surname fullName isActive")
        .lean<UserLite[]>();

    return users
        .map(u => toUserCandidate(u, {recordInactive: true}))
        .filter((c): c is AudienceCandidate => !!c);
}

export function leadCandidates(leads: LeadLite[], opts: {recordMissingEmail: boolean}): AudienceCandidate[] {
    const out: AudienceCandidate[] = [];
    for (const l of leads) {
        const firstName = l.firstName?.trim() || undefined;
        const lastName = l.lastName?.trim() || undefined;
        const fullName = `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || undefined;
        if (!l.email || l.email.trim() === "") {
            if (!opts.recordMissingEmail) continue;
            out.push({
                email: skippedEmail("lead", l._id),
                audienceKind: "lead",
                lead: l._id,
                firstName,
                lastName,
                fullName,
                languageCode: defaultLanguage(),
                skipReason: "no_email",
            });
            continue;
        }
        out.push({
            email: normalizeEmail(l.email),
            audienceKind: "lead",
            lead: l._id,
            firstName,
            lastName,
            fullName,
            languageCode: defaultLanguage(),
        });
    }
    return out;
}

/**
 * Everyone a campaign is aimed at, before consent is applied.
 *
 * `selected` reads the explicit lists; `all` resolves the whole audience within
 * the campaign's project/unit scope (empty scope = the whole tenant).
 */
export async function resolveAudienceCandidates(
    campaign: IAdCampaign,
    company: ObjectId,
): Promise<AudienceCandidate[]> {
    const candidates: AudienceCandidate[] = [];

    if (campaign.audienceMode === "selected") {
        const userIds = (campaign.recipients as unknown as ObjectId[]) ?? [];
        const leadIds = (campaign.leadRecipients as unknown as ObjectId[]) ?? [];

        if (userIds.length) {
            const users = await User.find({
                _id: {$in: userIds},
                companies: company,
            })
                .select("_id username name surname fullName isActive")
                .lean<UserLite[]>();
            candidates.push(
                ...users
                    .map(u => toUserCandidate(u, {recordInactive: true}))
                    .filter((c): c is AudienceCandidate => !!c),
            );
        }

        if (leadIds.length) {
            const leads = await Lead.find({_id: {$in: leadIds}, company})
                .select("_id email firstName lastName")
                .lean<LeadLite[]>();
            candidates.push(...leadCandidates(leads, {recordMissingEmail: true}));
        }

        return candidates;
    }

    // audienceMode === "all"
    if (campaign.includeClientUsers !== false) {
        candidates.push(...(await clientUserCandidates(campaign, company)));
    }

    if (campaign.includeLeads) {
        // Lost leads are excluded — mailing an offer to someone who has already
        // walked away is the fastest way to earn a spam complaint.
        const projectIds = refIds(campaign.projects);
        const unitIds = refIds(campaign.units);
        const leads = await Lead.find({
            company,
            status: {$nin: [LeadStatus.LOST]},
            ...leadInterestFilter(projectIds, unitIds),
        })
            .select("_id email firstName lastName")
            .lean<LeadLite[]>();
        candidates.push(...leadCandidates(leads, {recordMissingEmail: true}));
    }

    return candidates;
}

/**
 * Collapse candidates to one row per address.
 *
 * A `user` beats a `lead` on the same address: the common case is a website
 * enquiry that later became a buyer, and they must be mailed once, as the
 * client they now are.
 */
export function dedupeByEmail(candidates: AudienceCandidate[]): AudienceCandidate[] {
    const byEmail = new Map<string, AudienceCandidate>();
    for (const c of candidates) {
        if (!c.email) continue;
        const existing = byEmail.get(c.email);
        if (!existing) {
            byEmail.set(c.email, c);
            continue;
        }
        if (existing.audienceKind === "lead" && c.audienceKind === "user") {
            // Keep the lead back-reference so the consent row can link both.
            byEmail.set(c.email, {...c, lead: c.lead ?? existing.lead});
        }
        else if (existing.audienceKind === "user" && c.audienceKind === "lead") {
            byEmail.set(c.email, {...existing, lead: existing.lead ?? c.lead});
        }
    }
    return [...byEmail.values()];
}

/** Consent state for many addresses, chunked to keep `$in` lists sane. */
async function allowedByPreference(
    company: ObjectId,
    emails: string[],
    campaignType: AdCampaignType,
): Promise<Set<string>> {
    const blocked = new Set<string>();
    for (let i = 0; i < emails.length; i += PREFERENCE_LOOKUP_CHUNK) {
        const chunk = emails.slice(i, i + PREFERENCE_LOOKUP_CHUNK);
        const states = await marketingPreferenceService.getStatesForEmails(company, chunk);
        for (const [email, state] of states) {
            if (!marketingPreferenceService.isAllowed(state, campaignType)) blocked.add(email);
        }
    }
    return blocked;
}

export type MaterializeResult = {
    total: number;
    pending: number;
    suppressed: number;
};

/**
 * Turn a campaign's audience into `AdCampaignRecipient` rows.
 *
 * Idempotent: the `{campaign, email}` unique index means a re-run inserts only
 * what is missing, so a campaign interrupted mid-materialization can simply be
 * materialized again.
 *
 * Opted-out addresses are written as `suppressed`, **not dropped**. An admin
 * looking at a campaign that reached 400 of 900 people needs to see the other
 * 500 and why; silently omitting them makes the numbers unexplainable and
 * leaves no consent audit trail.
 */
export async function materializeAdCampaignRecipients(
    campaignId: ObjectId,
    company: ObjectId,
    logger?: {info?: (m: string) => void},
): Promise<MaterializeResult> {
    const campaign = await AdCampaign.findOne({_id: campaignId, company}).lean<IAdCampaign>();
    if (!campaign) throw new Error(`AdCampaign ${campaignId.toString()} not found`);

    await AdCampaign.updateOne({_id: campaignId, company}, {$set: {status: "materializing", lastError: null}});

    try {
        const candidates = dedupeByEmail(await resolveAudienceCandidates(campaign, company));
        const blocked = await allowedByPreference(
            company,
            candidates.map(c => c.email),
            campaign.campaignType,
        );

        const rows = candidates.map(c => {
            const skipped = !!c.skipReason;
            const suppressed = !skipped && blocked.has(c.email);
            return {
                company,
                campaign: campaignId,
                campaignType: campaign.campaignType,
                audienceKind: c.audienceKind,
                user: c.user,
                lead: c.lead,
                email: c.email,
                firstName: c.firstName,
                lastName: c.lastName,
                fullName: c.fullName,
                languageCode: c.languageCode,
                status: skipped ? "skipped" : suppressed ? "suppressed" : "pending",
                skipReason: skipped ? c.skipReason : suppressed ? "opted_out" : undefined,
                attempts: 0,
            };
        });

        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            const chunk = rows.slice(i, i + INSERT_CHUNK);
            try {
                await AdCampaignRecipient.insertMany(chunk, {ordered: false});
            }
            catch (err: any) {
                // Duplicate-key errors are the point of the unique index: they
                // mean the row already existed from an earlier run. Anything
                // else is real.
                const writeErrors = err?.writeErrors ?? [];
                const onlyDuplicates =
                    err?.code === 11000 ||
                    (writeErrors.length > 0 && writeErrors.every((e: any) => (e?.code ?? e?.err?.code) === 11000));
                if (!onlyDuplicates) throw err;
            }
        }

        const stats = await adCampaignService.recomputeStats(campaignId, company);
        logger?.info?.(
            `Campaign ${campaignId.toString()} materialized: ${stats.total} recipients, ${stats.skipped} suppressed`,
        );

        return {total: stats.total, pending: stats.pending, suppressed: stats.skipped};
    }
    catch (err: any) {
        await adCampaignService.finalize(campaignId, company, "failed", err?.message ?? String(err));
        throw err;
    }
}
