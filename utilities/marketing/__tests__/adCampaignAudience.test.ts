import {describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {dedupeByEmail, type AudienceCandidate} from "../adCampaignAudience";

const oid = () => new ObjectId();

function user(email: string, extra: Partial<AudienceCandidate> = {}): AudienceCandidate {
    return {email, audienceKind: "user", user: oid(), fullName: "A User", languageCode: "en-US", ...extra};
}

function lead(email: string, extra: Partial<AudienceCandidate> = {}): AudienceCandidate {
    return {email, audienceKind: "lead", lead: oid(), fullName: "A Lead", languageCode: "en-US", ...extra};
}

describe("dedupeByEmail", () => {
    it("keeps distinct addresses", () => {
        const out = dedupeByEmail([user("a@x.com"), lead("b@x.com")]);
        expect(out).toHaveLength(2);
        expect(out.map(c => c.email).sort()).toEqual(["a@x.com", "b@x.com"]);
    });

    it("collapses a repeated address to one row", () => {
        const out = dedupeByEmail([user("a@x.com"), user("a@x.com")]);
        expect(out).toHaveLength(1);
    });

    describe("when the same address is both a lead and a client", () => {
        // The common case: a website enquiry that later became a buyer. They
        // must be mailed once, as the client they now are.
        it("prefers the client, whichever order they arrive in", () => {
            const leadFirst = dedupeByEmail([lead("a@x.com"), user("a@x.com")]);
            expect(leadFirst).toHaveLength(1);
            expect(leadFirst[0].audienceKind).toBe("user");

            const userFirst = dedupeByEmail([user("a@x.com"), lead("a@x.com")]);
            expect(userFirst).toHaveLength(1);
            expect(userFirst[0].audienceKind).toBe("user");
        });

        it("keeps both back-references so the consent row can link each", () => {
            const l = lead("a@x.com");
            const u = user("a@x.com");

            const leadFirst = dedupeByEmail([l, u]);
            expect(leadFirst[0].user?.toString()).toBe(u.user!.toString());
            expect(leadFirst[0].lead?.toString()).toBe(l.lead!.toString());

            const userFirst = dedupeByEmail([u, l]);
            expect(userFirst[0].user?.toString()).toBe(u.user!.toString());
            expect(userFirst[0].lead?.toString()).toBe(l.lead!.toString());
        });
    });

    it("drops candidates with no address", () => {
        const out = dedupeByEmail([user(""), lead("b@x.com")]);
        expect(out).toHaveLength(1);
        expect(out[0].email).toBe("b@x.com");
    });

    it("treats addresses as already normalized", () => {
        // Normalization happens at candidate construction via `normalizeEmail`,
        // so two spellings reaching here are genuinely different keys. This
        // documents the contract rather than asserting a behaviour change.
        const out = dedupeByEmail([user("a@x.com"), user("A@X.com")]);
        expect(out).toHaveLength(2);
    });

    it("preserves order of first appearance", () => {
        const out = dedupeByEmail([user("c@x.com"), user("a@x.com"), user("b@x.com")]);
        expect(out.map(c => c.email)).toEqual(["c@x.com", "a@x.com", "b@x.com"]);
    });

    it("handles an empty audience", () => {
        expect(dedupeByEmail([])).toEqual([]);
    });
});
