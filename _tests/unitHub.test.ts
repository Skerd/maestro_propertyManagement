/**
 * The unit's sheet as a hub (UX-03, D151): each related list is read only when the caller's role may read that model,
 * and only this unit's records of this company, newest first.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import User from "@coreModule/database/schemas/user/user";
import Currency from "@coreModule/database/schemas/currency/currency";
import * as unitRoute from "@propertyManagement/api/realEstate/private/unit/unit";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
// The unit's single read populates its type and floor: their models must be registered.
import "@propertyManagement/database/schemas/unitType/unitType";
import "@propertyManagement/database/schemas/floor/floor";
import {asTenant, clearDatabase, seedCurrency, seedLease, seedRentRow, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([{...unitRoute, module: "propertyManagement"}]);
const single = (caller: TestCaller, _id: ObjectId) => request(app).post("/api/realEstate/unit/single").set(callerHeader(caller)).send({_id: _id.toString()});

let manager: TestCaller;
let unitsOnly: TestCaller;

beforeAll(async () => {
    await connectTestDatabase();
    const caller = (permissions: string[]): TestCaller => ({userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions});
    manager = caller(allPermissionTags([Unit, Sale, Reservation, Lease, RentalPayment, UnitCost, Inspection, ModificationRequest, User, Currency]));
    unitsOnly = caller(allPermissionTags([Unit, User, Currency]));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(clearDatabase));

describe("the unit's sheet as a hub (P13.6)", () => {
    it("lists this unit's reservations, leases and rent rows for a role that may read them, newest first", () => asCompany(async () => {
        const eur = await seedCurrency(companyId, "EUR");
        const client = await seedUser(companyId, "Arta");
        const unit = await seedUnit(companyId, {price: "200000.00", priceCurrency: eur});
        const otherUnit = await seedUnit(companyId, {price: "150000.00", priceCurrency: eur});

        const older = await seedReservation(companyId, {unit, client, status: "expired", isActive: false});
        const newer = await seedReservation(companyId, {unit, client});
        await Reservation.collection.updateOne({_id: older}, {$set: {reservationDate: "2026-01-05"}});
        await Reservation.collection.updateOne({_id: newer}, {$set: {reservationDate: "2026-03-01"}});
        await seedReservation(companyId, {unit: otherUnit, client});
        // Another company's record on the same unit id never shows.
        await seedReservation(otherCompanyId, {unit, client});

        const lease = await seedLease(companyId, {unit, tenant: client, currency: eur, startDate: "2026-04-01", endDate: "2027-03-31"});
        await seedRentRow(companyId, {lease, unit, currency: eur, dueDate: "2026-04-01"});
        await seedRentRow(companyId, {lease, unit, currency: eur, dueDate: "2026-05-01"});

        const full = await single(manager, unit);
        expect(full.status).toBe(200);
        expect(full.body.reservations.map((row: {_id: string}) => row._id)).toEqual([newer.toString(), older.toString()]);
        expect(full.body.leases.map((row: {_id: string}) => row._id)).toEqual([lease.toString()]);
        expect(full.body.rentalPayments.map((row: {dueDate: string}) => row.dueDate)).toEqual(["2026-05-01", "2026-04-01"]);
        expect(full.body.sales).toEqual([]);
        expect(full.body.costs).toEqual([]);
        expect(full.body.inspections).toEqual([]);
        expect(full.body.modificationRequests).toEqual([]);
    }));

    it("leaves every list out for a role that may read the unit but not those records", () => asCompany(async () => {
        const eur = await seedCurrency(companyId, "EUR");
        const client = await seedUser(companyId, "Arta");
        const unit = await seedUnit(companyId, {price: "200000.00", priceCurrency: eur});
        await seedReservation(companyId, {unit, client});
        await seedLease(companyId, {unit, tenant: client, currency: eur, startDate: "2026-04-01", endDate: "2027-03-31"});

        const limited = await single(unitsOnly, unit);
        expect(limited.status).toBe(200);
        expect(limited.body.name).toBe("Apartment");
        for (const key of ["sales", "reservations", "leases", "rentalPayments"]) expect(limited.body).not.toHaveProperty(key);
        // The unit's own refs to these give way to nothing, not to bare codes.
        for (const key of ["costs", "inspections", "modificationRequests"]) expect(limited.body[key]).toEqual([]);
    }));
});
