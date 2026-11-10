/**
 * Who a client email may go to (TD-B179, D131): active members of the company, plus anyone tied to one of its units
 * (buyer of a sale that was not rejected, client of an active reservation, tenant of an active lease) whatever their
 * membership. Before, the filter named a `User.isActive` field that does not exist, so nobody was ever left out.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {clientEmailRecipients} from "@propertyManagement/utilities/marketing/clientAudience";
import {asTenant, clearDatabase, seedCurrency, seedLease, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;

async function setMembership(user: ObjectId, active: "active" | "inactive" | "invited"): Promise<void> {
    await db().collection("users").updateOne({_id: user, "roles.company": companyId}, {$set: {"roles.$.active": active}});
}

async function seedSale(unit: ObjectId, buyer: ObjectId, approvalStatus: string): Promise<void> {
    await db().collection("sales").insertOne({_id: new ObjectId(), company: companyId, unit, buyer, approvalStatus, deletedAt: null});
}

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(async () => {
    await clearDatabase();
});

describe("clientEmailRecipients (D131)", {timeout: 30000}, () => {
    it("keeps active members and unit holders, drops deactivated members with no unit", () => asCompany(async () => {
        const chf = await seedCurrency(companyId, "CHF");
        const unit = () => seedUnit(companyId, {price: "100000", priceCurrency: chf});

        const member = await seedUser(companyId, "Member");
        const deactivated = await seedUser(companyId, "Gone");
        await setMembership(deactivated, "inactive");

        const buyer = await seedUser(companyId, "Buyer");
        await setMembership(buyer, "inactive");
        await seedSale(await unit(), buyer, "approved");

        const rejected = await seedUser(companyId, "Rejected");
        await setMembership(rejected, "inactive");
        await seedSale(await unit(), rejected, "rejected");

        const reserver = await seedUser(companyId, "Reserver");
        await setMembership(reserver, "invited");
        await seedReservation(companyId, {unit: await unit(), client: reserver});

        const expired = await seedUser(companyId, "Expired");
        await setMembership(expired, "inactive");
        await seedReservation(companyId, {unit: await unit(), client: expired, isActive: false, status: "expired"});

        const tenant = await seedUser(companyId, "Tenant");
        await setMembership(tenant, "inactive");
        await seedLease(companyId, {unit: await unit(), tenant, currency: chf, startDate: "2026-01-01", endDate: "2027-12-31"});

        const formerTenant = await seedUser(companyId, "Former");
        await setMembership(formerTenant, "inactive");
        await seedLease(companyId, {unit: await unit(), tenant: formerTenant, currency: chf, startDate: "2024-01-01", endDate: "2025-12-31", status: "terminated"});

        const all = [member, deactivated, buyer, rejected, reserver, expired, tenant, formerTenant];
        const recipients = await clientEmailRecipients(companyId, all);

        expect([...recipients].sort()).toEqual([member, buyer, reserver, tenant].map(String).sort());
    }));

    it("does not count another company's membership or units", () => asCompany(async () => {
        const otherCompany = new ObjectId();
        const outsider = await seedUser(otherCompany, "Outsider");

        expect(await clientEmailRecipients(companyId, [outsider])).toEqual(new Set());
        expect(await clientEmailRecipients(companyId, [])).toEqual(new Set());
    }));
});
