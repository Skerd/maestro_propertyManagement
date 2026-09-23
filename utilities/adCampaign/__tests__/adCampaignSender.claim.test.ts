import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

type Row = {
    _id: ObjectId;
    campaign: ObjectId;
    company: ObjectId;
    status: string;
    attempts: number;
    claimToken?: ObjectId;
    claimedAt?: Date;
    deletedAt: null;
};

const db = vi.hoisted(() => ({rows: [] as any[]}));

const same = (a: unknown, b: unknown) => String(a) === String(b);

/**
 * A faithful-enough stand-in for the recipient collection.
 *
 * The part that matters is that `updateMany` honours the `status` guard in its
 * filter, because that guard is the entire mutual-exclusion mechanism: two
 * workers each win only the rows they actually flipped.
 */
function matches(row: any, filter: any): boolean {
    if (filter._id?.$in && !filter._id.$in.some((id: any) => same(id, row._id))) return false;
    if (filter.campaign && !same(filter.campaign, row.campaign)) return false;
    if (filter.company && !same(filter.company, row.company)) return false;
    if (filter.status && row.status !== filter.status) return false;
    if (filter.claimToken && !same(filter.claimToken, row.claimToken)) return false;
    if (filter.deletedAt === null && row.deletedAt !== null) return false;
    return true;
}

vi.mock("@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient", () => ({
    default: {
        find: (filter: any) => {
            let rows = db.rows.filter(r => matches(r, filter));
            const chain: any = {
                sort: () => chain,
                limit: (n: number) => { rows = rows.slice(0, n); return chain; },
                select: () => chain,
                lean: async () => rows.map(r => ({...r})),
            };
            return chain;
        },
        updateMany: async (filter: any, update: any) => {
            let modifiedCount = 0;
            for (const row of db.rows) {
                if (!matches(row, filter)) continue;
                Object.assign(row, update.$set ?? {});
                for (const [k, v] of Object.entries(update.$inc ?? {})) {
                    (row as any)[k] = ((row as any)[k] ?? 0) + (v as number);
                }
                modifiedCount++;
            }
            return {modifiedCount};
        },
        countDocuments: async (filter: any) => db.rows.filter(r => matches(r, filter)).length,
        updateOne: async () => ({modifiedCount: 1}),
    },
}));

// Heavy collaborators the module imports at load time but this test never uses.
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({createPooledMailSession: vi.fn()}));
vi.mock("@coreModule/database/schemas/company/company", () => ({default: {findById: vi.fn()}}));
vi.mock("@propertyManagement/database/schemas/adCampaign/adCampaign", () => ({default: {findOneAndUpdate: vi.fn(), findOne: vi.fn(), updateOne: vi.fn()}}));
vi.mock("@propertyManagement/database/schemas/adCampaign/adCampaign.service", () => ({adCampaignService: {finalize: vi.fn(), recomputeStats: vi.fn()}}));
vi.mock("@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate.service", () => ({adCampaignTemplateService: {resolveForLocale: vi.fn()}}));
vi.mock("@propertyManagement/database/schemas/marketingPreference/marketingPreference.service", () => ({marketingPreferenceService: {getStatesForEmails: vi.fn(), isAllowed: vi.fn()}}));
vi.mock("@propertyManagement/utilities/emails/adCampaignNotifier", () => ({sendAdCampaignMail: vi.fn(), resolveRecipientLocale: vi.fn()}));
vi.mock("@propertyManagement/utilities/marketing/unsubscribeLinks", () => ({buildUnsubscribeUrls: vi.fn()}));

import {claimRecipientBatch} from "../adCampaignSender";

const campaign = new ObjectId();
const company = new ObjectId();

function seed(count: number): void {
    db.rows = Array.from({length: count}, () => ({
        _id: new ObjectId(),
        campaign,
        company,
        status: "pending",
        attempts: 0,
        deletedAt: null,
    })) as Row[];
}

describe("claimRecipientBatch", () => {
    beforeEach(() => seed(100));

    it("claims up to the batch size", async () => {
        const batch = await claimRecipientBatch(campaign, company, 25);
        expect(batch).toHaveLength(25);
        expect(batch.every(r => r.status === "queued")).toBe(true);
    });

    it("stamps a claim token, a claim time and an attempt", async () => {
        const batch = await claimRecipientBatch(campaign, company, 5);
        expect(batch.every(r => !!r.claimToken)).toBe(true);
        expect(batch.every(r => !!r.claimedAt)).toBe(true);
        expect(batch.every(r => r.attempts === 1)).toBe(true);
    });

    it("gives every row exactly one claim token", async () => {
        const batch = await claimRecipientBatch(campaign, company, 10);
        const tokens = new Set(batch.map(r => String(r.claimToken)));
        expect(tokens.size).toBe(1);
    });

    it("never returns the same row twice across sequential claims", async () => {
        const first = await claimRecipientBatch(campaign, company, 40);
        const second = await claimRecipientBatch(campaign, company, 40);
        const overlap = first.filter(a => second.some(b => String(a._id) === String(b._id)));
        expect(overlap).toHaveLength(0);
        expect(first.length + second.length).toBe(80);
    });

    it("returns nothing once every row is claimed", async () => {
        await claimRecipientBatch(campaign, company, 100);
        expect(await claimRecipientBatch(campaign, company, 10)).toHaveLength(0);
    });

    it("ignores rows belonging to another campaign", async () => {
        db.rows.push({
            _id: new ObjectId(), campaign: new ObjectId(), company,
            status: "pending", attempts: 0, deletedAt: null,
        } as Row);
        const batch = await claimRecipientBatch(campaign, company, 200);
        expect(batch).toHaveLength(100);
    });

    it("ignores rows that are not pending", async () => {
        db.rows.forEach((r, i) => { if (i < 30) r.status = "suppressed"; });
        const batch = await claimRecipientBatch(campaign, company, 200);
        expect(batch).toHaveLength(70);
    });

    describe("two workers racing", () => {
        it("hand back disjoint sets that never exceed the supply", async () => {
            // The real guarantee: concurrent claims must not double-send. Both
            // workers read the same candidate ids, but only one can flip each
            // row out of `pending`, so the winner takes it and the loser does not.
            const [a, b] = await Promise.all([
                claimRecipientBatch(campaign, company, 60),
                claimRecipientBatch(campaign, company, 60),
            ]);

            const idsA = new Set(a.map(r => String(r._id)));
            const idsB = new Set(b.map(r => String(r._id)));
            const overlap = [...idsA].filter(id => idsB.has(id));

            expect(overlap).toHaveLength(0);
            expect(a.length + b.length).toBeLessThanOrEqual(100);
        });

        it("leaves no row claimed by two tokens", async () => {
            await Promise.all([
                claimRecipientBatch(campaign, company, 50),
                claimRecipientBatch(campaign, company, 50),
            ]);
            const claimed = db.rows.filter(r => r.status === "queued");
            expect(claimed.every(r => r.attempts === 1)).toBe(true);
        });
    });
});
