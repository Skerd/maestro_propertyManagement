import {ObjectId} from "mongodb";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import {
    AD_CAMPAIGN_TYPE_PREFERENCE_FIELD,
    type AdCampaignType,
    type MarketingPreferenceSource,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import type {
    MarketingPreferenceState,
    MarketingPreferenceUpdateForm,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/marketingPreference.dto";
import MarketingPreference, {IMarketingPreference} from "./marketingPreference";

/** An address with no stored row is opted in to everything. */
function defaultState(email: string): MarketingPreferenceState {
    return {
        email,
        allowPriceChange: true,
        allowOffers: true,
        allowNewProjects: true,
    };
}

function toState(doc: IMarketingPreference): MarketingPreferenceState {
    return {
        email: doc.email,
        // `!== false` rather than a truthy check: a row written before a flag
        // existed has it undefined, which must read as allowed, not blocked.
        allowPriceChange: doc.allowPriceChange !== false,
        allowOffers: doc.allowOffers !== false,
        allowNewProjects: doc.allowNewProjects !== false,
        unsubscribedAllAt: doc.unsubscribedAllAt?.toISOString(),
    };
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export class MarketingPreferenceService extends BaseCrudService<IMarketingPreference, typeof MarketingPreference> {
    constructor() {
        super(MarketingPreference, "MarketingPreference");
    }

    /** Current consent for one address. Never creates a row. */
    async getState(company: ObjectId, email: string): Promise<MarketingPreferenceState> {
        const normalized = normalizeEmail(email);
        const doc = await MarketingPreference.findOne({company, email: normalized}).lean<IMarketingPreference>();
        return doc ? toState(doc) : defaultState(normalized);
    }

    /**
     * Consent for many addresses at once, as a map keyed by normalized email.
     *
     * Addresses with no row are simply absent from the map — callers treat a
     * miss as "allowed", matching {@link getState}. This is what the sender
     * uses to re-check a batch immediately before rendering, so someone who
     * unsubscribes from batch 1 is not mailed again in batch 40.
     */
    async getStatesForEmails(company: ObjectId, emails: string[]): Promise<Map<string, MarketingPreferenceState>> {
        const normalized = [...new Set(emails.map(normalizeEmail))].filter(Boolean);
        if (normalized.length === 0) return new Map();

        const docs = await MarketingPreference.find({
            company,
            email: {$in: normalized},
        }).lean<IMarketingPreference[]>();

        return new Map(docs.map(doc => [doc.email, toState(doc)]));
    }

    /** Whether this address currently accepts this campaign type. */
    isAllowed(state: MarketingPreferenceState | undefined, campaignType: AdCampaignType): boolean {
        if (!state) return true;
        return state[AD_CAMPAIGN_TYPE_PREFERENCE_FIELD[campaignType]] !== false;
    }

    /**
     * Apply a partial toggle update, creating the row if this is the person's
     * first ever change. Omitted flags keep their stored value.
     *
     * `unsubscribeAll` wins over the individual flags — a request that says
     * "turn everything off" must not be partially undone by a stale `true`
     * arriving in the same body.
     */
    async applyUpdate(params: {
        company: ObjectId;
        email: string;
        update: MarketingPreferenceUpdateForm;
        source: MarketingPreferenceSource;
        user?: ObjectId | null;
        lead?: ObjectId | null;
    }): Promise<MarketingPreferenceState> {
        const email = normalizeEmail(params.email);
        const {update} = params;

        const set: Record<string, unknown> = {lastChangedAt: new Date(), source: params.source};

        if (update.unsubscribeAll) {
            set.allowPriceChange = false;
            set.allowOffers = false;
            set.allowNewProjects = false;
            set.unsubscribedAllAt = new Date();
        }
        else {
            if (typeof update.allowPriceChange === "boolean") set.allowPriceChange = update.allowPriceChange;
            if (typeof update.allowOffers === "boolean") set.allowOffers = update.allowOffers;
            if (typeof update.allowNewProjects === "boolean") set.allowNewProjects = update.allowNewProjects;
        }

        // Only ever fill the back-refs in, never null them out — a later
        // anonymous unsubscribe must not erase the link to a known user.
        if (params.user) set.user = params.user;
        if (params.lead) set.lead = params.lead;

        const doc = await MarketingPreference.findOneAndUpdate(
            {company: params.company, email},
            {$set: set, $setOnInsert: {company: params.company, email}},
            {new: true, upsert: true, setDefaultsOnInsert: true},
        ).lean<IMarketingPreference>();

        return toState(doc);
    }

    /** Turn off exactly one campaign type — the one-click unsubscribe path. */
    async optOutOfType(params: {
        company: ObjectId;
        email: string;
        campaignType: AdCampaignType;
        source: MarketingPreferenceSource;
        user?: ObjectId | null;
        lead?: ObjectId | null;
    }): Promise<MarketingPreferenceState> {
        return this.applyUpdate({
            ...params,
            update: {[AD_CAMPAIGN_TYPE_PREFERENCE_FIELD[params.campaignType]]: false},
        });
    }

    /** Turn off every type at once. */
    async optOutOfAll(params: {
        company: ObjectId;
        email: string;
        source: MarketingPreferenceSource;
        user?: ObjectId | null;
        lead?: ObjectId | null;
    }): Promise<MarketingPreferenceState> {
        return this.applyUpdate({...params, update: {unsubscribeAll: true}});
    }
}

export const marketingPreferenceService = new MarketingPreferenceService();
