import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {LeaseActions} from "@propertyManagement/database/schemas/lease/lease.actions";
import {leaseService} from "@propertyManagement/database/schemas/lease/lease.service";
import {resyncLeaseSchedule} from "@propertyManagement/utilities/lease/leaseScheduleResync";
import {runRentalMaintenance} from "@propertyManagement/utilities/cronJobs/rentalMaintenanceJob";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, clearDatabase, dec, decString, findRaw, seedCompany, seedCurrency, seedLease, seedRentRow, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const params = actor(companyId);
const leases = new LeaseActions();
const db = () => mongoose.connection.db!;

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

afterEach(() => {
    vi.restoreAllMocks();
});

let chf: ObjectId;
let tenant: ObjectId;

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    await seedCompany(companyId, "Europe/Zurich");
    chf = await seedCurrency(companyId, "CHF");
    tenant = await seedUser(companyId, "Tenant");
}));

/** A rented unit on an active lease with one 1,000.00 rent row per given due date. */
async function seedRentedLease(dueDates: string[], input: {startDate?: string; endDate?: string} = {}) {
    const unit = await seedUnit(companyId, {price: "300000.00", priceCurrency: chf, status: UnitStatus.RENTED});
    const lease = await seedLease(companyId, {unit, tenant, currency: chf, startDate: input.startDate ?? "2026-01-01", endDate: input.endDate ?? "2026-12-31"});
    const rows = [];
    for (const dueDate of dueDates) rows.push(await seedRentRow(companyId, {lease, unit, currency: chf, dueDate}));
    return {unit, lease, rows};
}

const rowsOf = async (ids: ObjectId[]) => Promise.all(ids.map(async (id) => {
    const row = (await findRaw("rentalpayments", id))!;
    return [row.status, decString(row.paidAmount) ?? "0"];
}));

describe("recording a rent payment", {timeout: 60000}, () => {
    const record = (lease: ObjectId, paidAmount: number) =>
        leases.recordRentPayment({...params, _id: lease.toString(), paidAmount, paidDate: "2026-02-15"});

    it("fills the oldest open months first, partly and then in full", () => asCompany(async () => {
        const {lease, rows} = await seedRentedLease(["2026-01-01", "2026-02-01"]);
        await record(lease, 1500);
        expect(await rowsOf(rows)).toEqual([["paid", "1000.000"], ["partially_paid", "500.000"]]);

        await record(lease, 500);
        expect(await rowsOf(rows)).toEqual([["paid", "1000.000"], ["paid", "1000.000"]]);
    }));

    it("refuses more than the open rent, and a payment when nothing is open, changing nothing", () => asCompany(async () => {
        const {lease, rows} = await seedRentedLease(["2026-01-01"]);
        await expect(record(lease, 1000.01)).rejects.toMatchObject({error_code: "rental_payment_exceeds_open_due"});
        expect(await rowsOf(rows)).toEqual([["pending", "0"]]);

        await record(lease, 1000);
        await expect(record(lease, 1)).rejects.toMatchObject({error_code: "rental_payment_no_open_due"});
    }));

    it("refuses a lease that is no longer active", () => asCompany(async () => {
        const {lease} = await seedRentedLease(["2026-01-01"]);
        await db().collection("leases").updateOne({_id: lease}, {$set: {status: "terminated"}});
        await expect(record(lease, 100)).rejects.toMatchObject({error_code: "lease_not_active"});
    }));
});

describe("terminating a lease", {timeout: 60000}, () => {
    it("waives the unpaid months, keeps the paid ones and frees the unit", () => asCompany(async () => {
        const {unit, lease, rows} = await seedRentedLease(["2026-01-01", "2026-02-01", "2026-03-01"]);
        await db().collection("rentalpayments").updateOne({_id: rows[0]}, {$set: {status: "paid", paidAmount: dec("1000.00")}});
        await db().collection("rentalpayments").updateOne({_id: rows[1]}, {$set: {status: "overdue"}});

        await leases.terminate({...params, _id: lease.toString(), terminationReason: "  Tenant moved out ", terminationDate: "2026-02-20"});

        const stored = (await findRaw("leases", lease))!;
        expect([stored.status, stored.terminationReason]).toEqual(["terminated", "Tenant moved out"]);
        expect((await rowsOf(rows)).map(([status]) => status)).toEqual(["paid", "waived", "waived"]);
        expect((await findRaw("units", unit))!.status).toBe(UnitStatus.AVAILABLE);

        await expect(leases.terminate({...params, _id: lease.toString()})).rejects.toMatchObject({error_code: "lease_not_active"});
    }));
});

describe("resyncing the rent schedule after an edit", {timeout: 60000}, () => {
    const ctx = {logger: params.logger, languageCode: "en-US", company: {_id: companyId}};

    /** The lease before and after `edit` is written, as the lease route's afterUpdate sees them. */
    async function editLease(lease: ObjectId, edit: Record<string, unknown>) {
        const previous = await leaseService.findByIdOrThrow(lease, {});
        await db().collection("leases").updateOne({_id: lease}, {$set: edit});
        const current = await leaseService.findByIdOrThrow(lease, {});
        return () => resyncLeaseSchedule(previous, current, ctx);
    }

    async function seedWithPaidJanuary() {
        const seeded = await seedRentedLease(["2026-01-01", "2026-02-01", "2026-03-01"], {endDate: "2026-03-31"});
        await db().collection("rentalpayments").updateOne({_id: seeded.rows[0]}, {$set: {status: "paid", paidAmount: dec("1000.00")}});
        return seeded;
    }

    it("refuses to move the lease to another unit", () => asCompany(async () => {
        const {lease} = await seedWithPaidJanuary();
        const resync = await editLease(lease, {unit: new ObjectId()});
        await expect(resync()).rejects.toMatchObject({error_code: "lease_unit_immutable"});
    }));

    it("refuses a new rent currency once rent rows exist", () => asCompany(async () => {
        const {lease} = await seedWithPaidJanuary();
        const resync = await editLease(lease, {rentCurrency: await seedCurrency(companyId, "EUR")});
        await expect(resync()).rejects.toMatchObject({error_code: "lease_currency_change_with_payments"});
    }));

    it("refuses a term longer than 600 months", () => asCompany(async () => {
        const {lease} = await seedWithPaidJanuary();
        const resync = await editLease(lease, {endDate: "2077-01-01"});
        await expect(resync()).rejects.toMatchObject({error_code: "lease_term_too_long"});
    }));

    it("refuses to move the start once rent was collected", () => asCompany(async () => {
        const {lease, rows} = await seedWithPaidJanuary();
        const resync = await editLease(lease, {startDate: "2026-02-01"});
        await expect(resync()).rejects.toMatchObject({error_code: "lease_start_after_collected_rent"});
        expect(await db().collection("rentalpayments").countDocuments({lease})).toBe(rows.length);
    }));

    it("refuses to end the lease before a collected month, and waives the months a shorter lease drops", () => asCompany(async () => {
        const {lease, rows} = await seedWithPaidJanuary();
        const tooShort = await editLease(lease, {endDate: "2025-12-31"});
        await expect(tooShort()).rejects.toMatchObject({error_code: "lease_end_before_collected_rent"});

        await db().collection("leases").updateOne({_id: lease}, {$set: {endDate: "2026-03-31"}});
        const shorter = await editLease(lease, {endDate: "2026-01-31"});
        await shorter();
        expect((await rowsOf(rows)).map(([status]) => status)).toEqual(["paid", "waived", "waived"]);
    }));
});

describe("rental maintenance", {timeout: 60000}, () => {
    // 00:30 on 10 March in Zurich, still 9 March in UTC.
    const now = new Date("2026-03-09T23:30:00.000Z");

    it("expires leases whose last day is before the company's today, each on its own, past a failing one", () => asCompany(async () => {
        const failing = await seedRentedLease(["2026-03-01"], {endDate: "2026-03-01"});
        const ended = await seedRentedLease(["2026-03-01"], {endDate: "2026-03-09"});
        const lastDayToday = await seedRentedLease([], {endDate: "2026-03-10"});

        const update = leaseService.updateByIdOrThrow.bind(leaseService);
        vi.spyOn(leaseService, "updateByIdOrThrow").mockImplementation((id, ...rest) =>
            new ObjectId(String(id)).equals(failing.lease) ? Promise.reject(new Error("write failed")) : update(id, ...rest));

        await runRentalMaintenance(companyId, undefined, {now});

        const status = async (seeded: {lease: ObjectId; unit: ObjectId}) =>
            [(await findRaw("leases", seeded.lease))!.status, (await findRaw("units", seeded.unit))!.status];
        expect(await status(ended)).toEqual(["expired", UnitStatus.AVAILABLE]);
        expect((await rowsOf(ended.rows)).map(([s]) => s)).toEqual(["waived"]);
        // The failing lease rolled back whole: still active, its rent still open, its unit still rented.
        expect(await status(failing)).toEqual(["active", UnitStatus.RENTED]);
        expect((await rowsOf(failing.rows)).map(([s]) => s)).toEqual(["overdue"]);
        expect(await status(lastDayToday)).toEqual(["active", UnitStatus.RENTED]);
    }));

    it("marks rent overdue once its due day (plus grace days) is before the company's today", () => asCompany(async () => {
        const {rows} = await seedRentedLease(["2026-03-09", "2026-03-10"]);
        await runRentalMaintenance(companyId, undefined, {now});
        expect((await rowsOf(rows)).map(([s]) => s)).toEqual(["overdue", "pending"]);
    }));
});
