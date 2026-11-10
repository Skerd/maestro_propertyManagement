import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

// The emails themselves are not what these tests are about: each counts as sent.
vi.mock("@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchReservationClientEmail: vi.fn(async () => true),
}));
vi.mock("@propertyManagement/utilities/database/sale/saleClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchSaleClientEmail: vi.fn(async () => true),
}));
vi.mock("@propertyManagement/utilities/database/lease/leaseClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchLeaseClientEmail: vi.fn(async () => true),
}));

import {runReservationExpirationReminders} from "@propertyManagement/utilities/cronJobs/reservationExpirationReminderJob";
import {runPaymentPlanInstallmentReminders} from "@propertyManagement/utilities/cronJobs/paymentPlanInstallmentReminderJob";
import {runLeaseRentReminders} from "@propertyManagement/utilities/cronJobs/leaseRentReminderJob";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan, {InstallmentStatus, PaymentPlanStatus} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {asTenant, clearDatabase, dec, findRaw, seedCompany, seedCurrency, seedLease, seedRentRow, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;

// 00:30 on 10 March in Zurich (the company's today), still 9 March in UTC.
const now = new Date("2026-03-09T23:30:00.000Z");

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
let client: ObjectId;

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    await seedCompany(companyId, "Europe/Zurich");
    chf = await seedCurrency(companyId, "CHF");
    client = await seedUser(companyId, "Client");
}));

/** An unpaid reservation holding its unit, expiring on `expirationDate` (a local `YYYY-MM-DD` day, D115). */
async function seedHeldReservation(expirationDate: string, input: {paid?: boolean} = {}) {
    const unit = await seedUnit(companyId, {price: "250000.00", priceCurrency: chf, status: UnitStatus.RESERVED});
    const reservation = await seedReservation(companyId, {unit, client, paid: input.paid ?? false});
    await db().collection("reservations").updateOne({_id: reservation}, {$set: {expirationDate: expirationDate}});
    await db().collection("units").updateOne({_id: unit}, {$set: {reservation}});
    return {unit, reservation};
}

describe("reservation expiry", {timeout: 60000}, () => {
    it("ends each reservation whose last day is before the company's today, once, past a failing one", () => asCompany(async () => {
        const failing = await seedHeldReservation("2026-03-01");
        const ended = await seedHeldReservation("2026-03-09");
        const lastDayToday = await seedHeldReservation("2026-03-10");
        const paid = await seedHeldReservation("2026-03-01", {paid: true});
        const commission = await Commission.collection.insertOne({
            company: companyId, agent: client, sourceType: "reservation", sourceId: ended.reservation, reservation: ended.reservation,
            basis: "depositAmount", basisAmount: dec("5000.00"), ratePercent: 3, amount: dec("150.00"), currency: chf, status: "pending", deletedAt: null,
        });

        const update = reservationService.updateByIdOrThrow.bind(reservationService);
        vi.spyOn(reservationService, "updateByIdOrThrow").mockImplementation((id, ...rest) =>
            new ObjectId(String(id)).equals(failing.reservation) ? Promise.reject(new Error("write failed")) : update(id, ...rest));

        await runReservationExpirationReminders(companyId, undefined, {now});

        const state = async ({unit, reservation}: {unit: ObjectId; reservation: ObjectId}) => {
            const [r, u] = [(await findRaw("reservations", reservation))!, (await findRaw("units", unit))!];
            return [r.status, r.isActive, u.status, u.reservation ? "held" : "free"];
        };
        // Expired keeps isActive (the screens read the status); the unit is free and the commission void.
        expect(await state(ended)).toEqual(["expired", true, UnitStatus.AVAILABLE, "free"]);
        expect((await Commission.collection.findOne({_id: commission.insertedId}))!.status).toBe("voided");
        expect(await state(failing)).toEqual(["active", true, UnitStatus.RESERVED, "held"]);
        expect(await state(lastDayToday)).toEqual(["active", true, UnitStatus.RESERVED, "held"]);
        expect(await state(paid)).toEqual(["active", true, UnitStatus.RESERVED, "held"]);

        const expiredAt = (await findRaw("reservations", ended.reservation))!.expiredAt;
        vi.restoreAllMocks();
        await runReservationExpirationReminders(companyId, undefined, {now: new Date("2026-03-10T08:00:00.000Z")});
        expect((await findRaw("reservations", ended.reservation))!.expiredAt).toEqual(expiredAt);
        expect((await state(failing))[0]).toBe("expired");
    }));

    it("reminds on the company's calendar day: day-of and one day before", () => asCompany(async () => {
        const dayOf = await seedHeldReservation("2026-03-10");
        const tomorrow = await seedHeldReservation("2026-03-11");
        await runReservationExpirationReminders(companyId, undefined, {now});

        const stamps = async ({reservation}: {reservation: ObjectId}) => {
            const r = (await findRaw("reservations", reservation))!;
            return [!!r.expirationReminderEmailAt0d, !!r.expirationReminderEmailAt1d, !!r.expirationReminderEmailAt3d];
        };
        expect(await stamps(dayOf)).toEqual([true, false, false]);
        expect(await stamps(tomorrow)).toEqual([false, true, false]);
    }));
});

describe("installment reminders", {timeout: 60000}, () => {
    it("pick the day by the company's today: overdue, day-of, and one day before", () => asCompany(async () => {
        const saleId = new ObjectId();
        const unit = await seedUnit(companyId, {price: "30000.00", priceCurrency: chf, status: UnitStatus.SOLD, sale: saleId});
        await Sale.collection.insertOne({
            _id: saleId, company: companyId, unit, buyer: client, soldBy: client, paymentType: "payment_plan", saleDate: "2026-01-01",
            saleCurrency: chf, finalPrice: dec("30000.00"), name: "SALE-1", deletedAt: null,
        });
        const dues = ["2026-03-09", "2026-03-10", "2026-03-11"];
        const plan = await PaymentPlan.create({
            sale: saleId, company: companyId, status: PaymentPlanStatus.ACTIVE, totalAmount: dec("30000.00"), downPayment: dec("0"), downPaymentPaid: true,
            remainingBalance: dec("0"), numberOfInstallments: dues.length, installmentAmount: dec("10000.00"), interestRate: 0, gracePeriodDays: 0,
            startDate: "2026-01-01", endDate: "2026-12-01",
            installments: dues.map((due, i) => ({
                installmentNumber: i + 1, dueDate: due, amount: dec("10000.00"), principalAmount: dec("10000.00"), interestAmount: dec("0"),
                status: InstallmentStatus.PENDING,
            })),
        });

        await runPaymentPlanInstallmentReminders(companyId, undefined, {now});

        const installments = (await PaymentPlan.findById(plan._id).lean())!.installments;
        expect(installments.map((inst) => [
            inst.status, !!inst.installmentOverdueNoticeEmailAt, !!inst.installmentReminderEmailAt0d, !!inst.installmentReminderEmailAt1d,
        ])).toEqual([
            [InstallmentStatus.OVERDUE, true, false, false],
            [InstallmentStatus.PENDING, false, true, false],
            [InstallmentStatus.PENDING, false, false, true],
        ]);
    }));
});

describe("installment late fees (TD-B134, D121)", {timeout: 60000}, () => {
    it("stamps the fee exactly at the sale currency's decimals, on defaulted plans too, without changing the amount due", () => asCompany(async () => {
        const kwd = await seedCurrency(companyId, "KWD", 3);
        const saleId = new ObjectId();
        const unit = await seedUnit(companyId, {price: "2469.134", priceCurrency: kwd, status: UnitStatus.SOLD, sale: saleId});
        await Sale.collection.insertOne({
            _id: saleId, company: companyId, unit, buyer: client, soldBy: client, paymentType: "payment_plan", saleDate: "2026-01-01",
            saleCurrency: kwd, finalPrice: dec("2469.134"), name: "SALE-KWD", deletedAt: null,
        });
        const plan = await PaymentPlan.create({
            sale: saleId, company: companyId, status: PaymentPlanStatus.ACTIVE, totalAmount: dec("2469.134"), downPayment: dec("0"), downPaymentPaid: true,
            remainingBalance: dec("0"), numberOfInstallments: 2, installmentAmount: dec("2469.134"), interestRate: 0, gracePeriodDays: 0,
            lateFeePercentage: 1.5, startDate: "2026-01-01", endDate: "2026-12-01",
            installments: ["2026-03-01", "2026-03-05"].map((due, i) => ({
                installmentNumber: i + 1, dueDate: due, amount: dec("1234.567"), principalAmount: dec("1234.567"), interestAmount: dec("0"),
                status: i === 0 ? InstallmentStatus.OVERDUE : InstallmentStatus.PENDING,
            })),
        });
        expect((await PaymentPlan.findById(plan._id).lean())!.status).toBe(PaymentPlanStatus.DEFAULTED);

        await runPaymentPlanInstallmentReminders(companyId, undefined, {now});

        const stored = (await PaymentPlan.findById(plan._id).lean())!;
        const second = stored.installments[1];
        // 1.5 % of 1234.567 = 18.518505 → 18.519 (fils), not 18.52 (cents) nor a 10-decimal float.
        expect([second.status, second.lateFeeAmount?.toString(), second.amount.toString()]).toEqual([InstallmentStatus.OVERDUE, "18.519", "1234.567"]);
        expect(stored.remainingBalance.toString()).toBe("2469.134");
    }));
});

describe("rent reminders", {timeout: 60000}, () => {
    it("pick the day by the company's today: overdue, day-of, and one day before", () => asCompany(async () => {
        const unit = await seedUnit(companyId, {price: "300000.00", priceCurrency: chf, status: UnitStatus.RENTED});
        const lease = await seedLease(companyId, {unit, tenant: client, currency: chf, startDate: "2026-01-01", endDate: "2026-12-31"});
        const rows = [];
        for (const dueDate of ["2026-03-09", "2026-03-10", "2026-03-11"]) rows.push(await seedRentRow(companyId, {lease, unit, currency: chf, dueDate}));

        await runLeaseRentReminders(companyId, undefined, {now});

        const stamps = await Promise.all(rows.map(async (id) => {
            const row = (await findRaw("rentalpayments", id))!;
            return [!!row.rentOverdueNoticeEmailAt, !!row.rentReminderEmailAt0d, !!row.rentReminderEmailAt1d];
        }));
        expect(stamps).toEqual([[true, false, false], [false, true, false], [false, false, true]]);
    }));
});
