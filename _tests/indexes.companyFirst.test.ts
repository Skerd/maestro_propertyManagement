/**
 * DB-06 for the four busiest propertyManagement collections (TD-B151): every index starts with `company`, and the
 * planner serves the common tenant queries from one of them (`explain()` evidence).
 */
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import type {Collection} from "mongoose";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Unit from "@propertyManagement/database/schemas/unit/unit";

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

/**
 * Indexes allowed not to lead with `company`: unique references (one row per referenced record), a client's own
 * reservations across companies, and the core plugins' own (`createdBy`, `deletedAt`).
 */
const NOT_COMPANY_FIRST = new Set(["_id", "sale", "reservation", "client,company", "createdBy", "deletedAt"]);

/** The indexes the collection really has, after the test database built them from the schema. */
async function keysOf(model: {collection: Collection}): Promise<string[][]> {
    return (await model.collection.indexes()).map((index) => Object.keys(index.key));
}

describe("company-first indexes (DB-06)", () => {
    it.each([
        ["reservations", Reservation],
        ["sales", Sale],
        ["paymentplans", PaymentPlan],
        ["units", Unit],
    ] as const)("%s: every index leads with company", async (_name, model) => {
        const offending = (await keysOf(model))
            .filter((keys) => keys[0] !== "company" && !NOT_COMPANY_FIRST.has(keys.join(",")));
        expect(offending).toEqual([]);
    });

    const company = new ObjectId();
    const unit = new ObjectId();

    /** The index the winning plan scans, read from `explain()`. */
    async function winningIndex(model: {collection: Collection}, filter: Record<string, unknown>, sort: Record<string, 1 | -1> = {}): Promise<Record<string, number> | undefined> {
        const explained = await model.collection.find(filter).sort(sort).explain("queryPlanner") as {queryPlanner: {winningPlan: unknown}};
        const stack: unknown[] = [explained.queryPlanner.winningPlan];
        while (stack.length) {
            const stage = stack.pop() as {stage?: string; keyPattern?: Record<string, number>; inputStage?: unknown; inputStages?: unknown[]};
            if (stage.stage === "IXSCAN") return stage.keyPattern;
            if (stage.inputStage) stack.push(stage.inputStage);
            if (stage.inputStages) stack.push(...stage.inputStages);
        }
        return undefined;
    }

    it.each([
        ["a unit's active reservation", Reservation, {company, unit, isActive: true}, {}],
        ["the expiry sweep", Reservation, {company, isActive: true, paid: false, status: "active", expirationDate: {$lt: "2027-01-01"}}, {}],
        ["a unit's sales", Sale, {company, unit}, {}],
        ["an agent's sales", Sale, {company, soldBy: new ObjectId(), createdAt: {$gte: new Date(0)}}, {}],
        ["the installment sweep", PaymentPlan, {company, status: {$in: ["active", "defaulted"]}}, {_id: 1}],
        ["a floor's units by status", Unit, {company, floor: new ObjectId(), status: "available_unit"}, {createdAt: -1}],
    ] as const)("%s is served by a company-first index", async (_name, model, filter, sort) => {
        const keyPattern = await winningIndex(model, filter, sort);
        expect(keyPattern && Object.keys(keyPattern)[0]).toBe("company");
    });
});
