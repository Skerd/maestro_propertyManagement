import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import User from "@coreModule/database/schemas/user/user";
import Role from "@coreModule/database/schemas/role/role";
import RolePermission from "@coreModule/database/schemas/rolePermission/rolePermission";
import * as groupDashboardRoute from "@propertyManagement/api/realEstate/private/groupDashboard";
import * as unitRoute from "@propertyManagement/api/realEstate/private/unit/unit";
import * as saleRoute from "@propertyManagement/api/realEstate/private/unit/sale";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import PaymentPlan, {InstallmentStatus, PaymentPlanStatus} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {asTenant, clearDatabase, dec, seedCurrency, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const hqId = new ObjectId();
/** A branch where the caller's role may read units. */
const memberBranchId = new ObjectId();
/** A branch where the caller is a member without access to the dashboard's records. */
const blindBranchId = new ObjectId();
/** A branch the caller does not belong to. */
const otherBranchId = new ObjectId();
const asHq = asTenant(hqId);
const dashboardApp = appFor([{...groupDashboardRoute, module: "propertyManagement"}]);
const unitApp = appFor([{...unitRoute, module: "propertyManagement"}]);
const saleApp = appFor([{...saleRoute, module: "propertyManagement"}]);

let admin: TestCaller;
const noAccess: TestCaller = {userId: new ObjectId().toString(), companyId: hqId.toString(), permissions: []};

beforeAll(async () => {
    await connectTestDatabase();
    admin = {
        userId: new ObjectId().toString(),
        companyId: hqId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([Unit, Sale, Reservation, Commission, Lease, PaymentPlan]),
    };
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asHq(() => clearDatabase()));

describe("group dashboard", {timeout: 60000}, () => {
    it("reads each branch the caller may read as that branch, and leaves out the others", async () => {
        await asCrossTenant("test fixtures span the group's companies", async () => {
            await mongoose.connection.db!.collection("companies").insertMany([
                // Each company needs its own VAT number (a unique index).
                {_id: hqId, name: "HQ", vat: "CHE-1", deletedAt: null},
                {_id: memberBranchId, name: "Branch A", vat: "CHE-2", parentCompany: hqId, deletedAt: null},
                {_id: blindBranchId, name: "Branch B", vat: "CHE-3", parentCompany: hqId, deletedAt: null},
                {_id: otherBranchId, name: "Branch C", vat: "CHE-4", parentCompany: hqId, deletedAt: null},
            ]);
            const permissions = allPermissionTags([Unit]).map((tag) => ({_id: new ObjectId(), tag, module: "propertyManagement"}));
            await RolePermission.collection.insertMany(permissions);
            const reader = {_id: new ObjectId(), company: memberBranchId, name: "Sales", slug: "sales_a", isAdmin: false, permissions: permissions.map((permission) => permission._id)};
            const clerk = {_id: new ObjectId(), company: blindBranchId, name: "Clerk", slug: "clerk_b", isAdmin: false, permissions: []};
            await Role.collection.insertMany([reader, clerk]);
            const member = (company: ObjectId, roles: ObjectId[]) => ({_id: new ObjectId(), company, roles, rolesCount: roles.length, active: "active"});
            await User.collection.insertOne({
                _id: new ObjectId(admin.userId), username: "lea@example.com", name: "Lea", surname: "Lead",
                roles: [member(hqId, []), member(memberBranchId, [reader._id]), member(blindBranchId, [clerk._id])],
            });
            for (const [company, count] of [[hqId, 2], [memberBranchId, 1], [blindBranchId, 4], [otherBranchId, 3]] as const) {
                const currency = await seedCurrency(company, "CHF");
                for (let i = 0; i < count; i++) await seedUnit(company, {price: "1000.00", priceCurrency: currency});
            }
        });

        const response = await request(dashboardApp).post("/api/realEstate/groupDashboard").set(callerHeader(admin)).send({});
        expect(response.status).toBe(200);
        expect(response.body.branches.map((b: {companyName: string; totalUnits: number}) => [b.companyName, b.totalUnits]))
            .toEqual([["Test company", 2], ["Branch A", 1]]); // the root's name is the signed-in company's
        expect(response.body.totals.totalUnits).toBe(3);
    });
});

describe("unit availability", {timeout: 60000}, () => {
    const availability = (body: Record<string, unknown>, caller = admin) =>
        request(unitApp).post("/api/realEstate/unit/availability").set(callerHeader(caller)).send(body);

    it("refuses malformed filters and callers who may not read units", async () => {
        const badId = await availability({projectId: "not-an-id"});
        expect([badId.status, badId.body.error_code]).toEqual([400, "form_not_correct"]);
        const badDate = await availability({dateFrom: "2026-13-01"});
        expect([badDate.status, badDate.body.error_code]).toEqual([400, "form_not_correct"]);
        expect((await availability({})).status).toBe(200);
        const forbidden = await availability({}, noAccess);
        expect([forbidden.status, forbidden.body.error_code]).toEqual([403, "schema_sanitizer_no_read_permission"]);
    });

    it("shows only the windows that overlap the chosen days", async () => {
        const unitId = await asHq(async () => {
            const currency = await seedCurrency(hqId, "CHF");
            const client = await seedUser(hqId);
            const id = await seedUnit(hqId, {price: "1000.00", priceCurrency: currency, status: UnitStatus.SOLD});
            const inRange = await seedReservation(hqId, {unit: id, client, status: "converted"});
            const before = await seedReservation(hqId, {unit: id, client, status: "cancelled", isActive: false});
            await Reservation.collection.updateOne({_id: inRange}, {$set: {name: "IN", reservationDate: "2026-03-01", expirationDate: "2026-04-30"}});
            await Reservation.collection.updateOne({_id: before}, {$set: {name: "BEFORE", reservationDate: "2026-01-01", cancelledAt: new Date("2026-01-20")}});
            await Sale.collection.insertMany([
                {company: hqId, unit: id, name: "SOLD-IN", saleDate: "2026-04-15", deletedAt: null},
                {company: hqId, unit: id, name: "SOLD-AFTER", saleDate: "2026-06-01", deletedAt: null},
            ]);
            return id;
        });

        const response = await availability({unitId: unitId.toString(), dateFrom: "2026-02-01", dateTo: "2026-04-30"});
        expect(response.status).toBe(200);
        expect(response.body.entries[0].windows.map((w: {reference: string}) => w.reference)).toEqual(["IN", "SOLD-IN"]);
        expect([response.body.dateFrom, response.body.dateTo]).toEqual(["2026-02-01", "2026-04-30"]);
    });
});

describe("payment plan PDF", {timeout: 60000}, () => {
    it("refuses a malformed id and callers who may not read payment plans, and sends the schedule", async () => {
        const planId = await asHq(async () => (await PaymentPlan.create({
            sale: new ObjectId(), company: hqId, status: PaymentPlanStatus.ACTIVE, totalAmount: dec("1000.00"), downPayment: dec("0"),
            downPaymentPaid: false, remainingBalance: dec("0"), numberOfInstallments: 1, installmentAmount: dec("1000.00"),
            startDate: "2026-01-01", endDate: "2026-02-01",
            installments: [{installmentNumber: 1, dueDate: "2026-02-01", amount: dec("1000.00"), principalAmount: dec("1000.00"), interestAmount: dec("0"), status: InstallmentStatus.PENDING}],
        }))._id);
        const pdf = (body: Record<string, unknown>, caller = admin) =>
            request(saleApp).post("/api/realEstate/unit/sale/paymentPlan/pdf").set(callerHeader(caller)).send(body);

        const bad = await pdf({_id: "nope"});
        expect([bad.status, bad.body.error_code]).toEqual([400, "form_not_correct"]);
        const forbidden = await pdf({_id: planId.toString()}, noAccess);
        expect(forbidden.status).toBe(403);
        const ok = await pdf({_id: planId.toString()});
        expect([ok.status, ok.headers["content-type"]]).toEqual([200, "application/pdf"]);
    });
});
