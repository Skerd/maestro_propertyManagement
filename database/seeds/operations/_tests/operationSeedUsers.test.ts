/**
 * TD-B209: a seed row whose user exists in no dev profile is skipped silently, so the operation seeds name only echo
 * (core user defaults) and the PM demo clients, which exist before these seeds load their user refs.
 */
import {describe, expect, it} from "vitest";
import {pmDemoClientSeeds} from "../demoClients";
import {commissionsSeed} from "../commissions.seed";
import {inspectionsSeed} from "../inspections.seed";
import {leadsSeed} from "../leads.seed";
import {leasesSeed} from "../leases.seed";
import {modificationRequestsSeed} from "../modificationRequests.seed";
import {reservationsSeed} from "../reservations.seed";
import {salesSeed} from "../sales.seed";
import {snagsSeed} from "../snags.seed";
import {unitCostsSeed} from "../unitCosts.seed";

/** Every `{$user}` reference anywhere in the rows. */
function namedUsers(rows: readonly unknown[]): Set<string> {
    const users = new Set<string>();
    const walk = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") {
            for (const [key, inner] of Object.entries(value)) {
                if (key === "$user" && typeof inner === "string") users.add(inner);
                else walk(inner);
            }
        }
    };
    walk(rows);
    return users;
}

describe("PM operation seed users", () => {
    it("names only users the dev profiles have when the seeds run", () => {
        const known = new Set(["echo@echo.com", ...pmDemoClientSeeds.map((client) => client.username)]);
        const seeds = {commissionsSeed, inspectionsSeed, leadsSeed, leasesSeed, modificationRequestsSeed, reservationsSeed, salesSeed, snagsSeed, unitCostsSeed};
        for (const [name, rows] of Object.entries(seeds)) {
            expect([...namedUsers(rows)].filter((user) => !known.has(user)), name).toEqual([]);
        }
    });
});
