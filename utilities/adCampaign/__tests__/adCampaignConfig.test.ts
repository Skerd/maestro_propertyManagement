import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const env = vi.hoisted(() => ({SERVER: {NODE_ENV: "development"}}));
vi.mock("@coreModule/environment", () => env);

import {adCampaignSendConfig, bulkSendBlockedReason, effectiveRecipient} from "../adCampaignConfig";

const ORIGINAL = {...process.env};

describe("ad campaign send safety", () => {
    beforeEach(() => {
        for (const key of ["AD_CAMPAIGN_ALLOW_NONPROD_SEND", "AD_CAMPAIGN_REDIRECT_ALL_TO", "AD_CAMPAIGN_SEND_CONCURRENCY", "AD_CAMPAIGN_STUCK_AFTER_MINUTES"]) {
            delete process.env[key];
        }
        env.SERVER.NODE_ENV = "development";
    });

    afterEach(() => {
        process.env = {...ORIGINAL};
    });

    describe("the non-production guard", () => {
        // The highest-consequence risk in the feature: a dev database seeded
        // with real client addresses plus one working SMTP row is enough to
        // mail thousands of real buyers, irreversibly, from a laptop.
        it("blocks bulk sending outside production by default", () => {
            expect(bulkSendBlockedReason()).toBeTruthy();
            expect(bulkSendBlockedReason()).toContain("AD_CAMPAIGN_ALLOW_NONPROD_SEND");
        });

        it("allows it in production", () => {
            env.SERVER.NODE_ENV = "production";
            expect(bulkSendBlockedReason()).toBeNull();
        });

        it("allows it outside production only on an explicit opt-in", () => {
            process.env.AD_CAMPAIGN_ALLOW_NONPROD_SEND = "true";
            expect(bulkSendBlockedReason()).toBeNull();
        });

        it("treats anything other than an explicit true as still blocked", () => {
            for (const value of ["false", "no", "0", "", "yes-please"]) {
                process.env.AD_CAMPAIGN_ALLOW_NONPROD_SEND = value;
                expect(bulkSendBlockedReason(), value).toBeTruthy();
            }
        });

        it("accepts 1 as an opt-in", () => {
            process.env.AD_CAMPAIGN_ALLOW_NONPROD_SEND = "1";
            expect(bulkSendBlockedReason()).toBeNull();
        });
    });

    describe("the redirect escape hatch", () => {
        it("returns the real address when unset", () => {
            expect(effectiveRecipient("client@real.example")).toBe("client@real.example");
        });

        it("redirects every address when set", () => {
            process.env.AD_CAMPAIGN_REDIRECT_ALL_TO = "dev@inbox.example";
            expect(effectiveRecipient("client@real.example")).toBe("dev@inbox.example");
            expect(effectiveRecipient("other@real.example")).toBe("dev@inbox.example");
        });
    });

    describe("tunables", () => {
        it("has sane defaults", () => {
            const c = adCampaignSendConfig();
            expect(c.concurrency).toBe(5);
            expect(c.stuckAfterMinutes).toBe(15);
        });

        it("reads overrides from the environment", () => {
            process.env.AD_CAMPAIGN_SEND_CONCURRENCY = "12";
            process.env.AD_CAMPAIGN_STUCK_AFTER_MINUTES = "30";
            const c = adCampaignSendConfig();
            expect(c.concurrency).toBe(12);
            expect(c.stuckAfterMinutes).toBe(30);
        });

        it("ignores nonsense overrides rather than sending with concurrency 0", () => {
            for (const value of ["0", "-3", "abc", ""]) {
                process.env.AD_CAMPAIGN_SEND_CONCURRENCY = value;
                expect(adCampaignSendConfig().concurrency, value).toBe(5);
            }
        });
    });
});
