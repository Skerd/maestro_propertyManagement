import {describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {dedupeByEmail, leadCandidates, leadInterestFilter, toUserCandidate, type AudienceCandidate} from "../adCampaignAudience";

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

describe("leadInterestFilter", () => {
    it("scopes to a unit when units are set", () => {
        const unit = oid();
        expect(leadInterestFilter([oid()], [unit])).toEqual({unitInterest: unit});
    });

    it("uses $in when several units are in scope", () => {
        const a = oid();
        const b = oid();
        expect(leadInterestFilter([oid()], [a, b])).toEqual({unitInterest: {$in: [a, b]}});
    });

    it("scopes to a project when only projects are set", () => {
        const project = oid();
        expect(leadInterestFilter([project], [])).toEqual({projectInterest: project});
    });

    it("is empty when the campaign has no inventory scope", () => {
        expect(leadInterestFilter([], [])).toEqual({});
    });
});

describe("skip reasons", () => {
    it("writes no_email when a selected user has no username", () => {
        const id = oid();
        const row = toUserCandidate({_id: id}, {recordInactive: true});
        expect(row?.skipReason).toBe("no_email");
        expect(row?.email).toBe(`skipped.user.${id.toString()}@invalid.example`);
    });

    it("writes inactive when a selected user is deactivated", () => {
        const row = toUserCandidate(
            {_id: oid(), username: "ana@x.com", isActive: false, name: "Ana", surname: "Marku"},
            {recordInactive: true},
        );
        expect(row?.skipReason).toBe("inactive");
        expect(row?.email).toBe("ana@x.com");
        expect(row?.firstName).toBe("Ana");
        expect(row?.lastName).toBe("Marku");
    });

    it("writes no_email when a selected lead has no address", () => {
        const id = oid();
        const rows = leadCandidates(
            [{_id: id, firstName: "Ana", lastName: "Marku"}],
            {recordMissingEmail: true},
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].skipReason).toBe("no_email");
        expect(rows[0].email).toBe(`skipped.lead.${id.toString()}@invalid.example`);
        expect(rows[0].firstName).toBe("Ana");
    });
});
