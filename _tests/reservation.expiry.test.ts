import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import type {SalesStaffAlertEmail} from "@propertyManagement/utilities/emails/staffAlertNotifiers";
import type {DispatchReservationClientEmailInput} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    staffMail: vi.fn<[SalesStaffAlertEmail], Promise<void>>(),
    clientEmail: vi.fn<[DispatchReservationClientEmailInput], Promise<boolean>>(),
}));

// What is sent is recorded, not delivered.
vi.mock("@coreModule/domain/notifications/notificationEventBus", async (importOriginal) => ({
    ...await importOriginal<object>(),
    emitNotificationEvent: mocks.emit,
}));
vi.mock("@propertyManagement/utilities/emails/staffAlertNotifiers", async (importOriginal) => ({
    ...await importOriginal<object>(),
    sendSalesStaffAlertMail: mocks.staffMail,
}));
vi.mock("@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchReservationClientEmail: mocks.clientEmail,
}));

import {runReservationExpirationReminders} from "@propertyManagement/utilities/cronJobs/reservationExpirationReminderJob";
import {ReservationActions} from "@propertyManagement/database/schemas/reservation/reservation.actions";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, clearDatabase, dec, findRaw, seedCompany, seedCurrency, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const otherCompany = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;
const reservations = new ReservationActions();
const params = actor(companyId);

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
    vi.useRealTimers();
});

let chf: ObjectId;
let client: ObjectId;
let agent: ObjectId;
let watcher: ObjectId;

/** A user with a role entry in `company` (this one by default), active unless said otherwise. */
async function member(name: string, input: {company?: ObjectId; active?: "active" | "inactive"} = {}): Promise<ObjectId> {
    const company = input.company ?? companyId;
    const _id = await seedUser(company, name);
    await db().collection("users").updateOne({_id}, {$set: {companies: [company], "roles.0.active": input.active ?? "active"}});
    return _id;
}

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    mocks.emit.mockReset();
    mocks.staffMail.mockReset().mockResolvedValue(undefined);
    mocks.clientEmail.mockReset().mockResolvedValue(true);
    await seedCompany(companyId, "Europe/Zurich");
    chf = await seedCurrency(companyId, "CHF");
    client = await member("Client");
    agent = await member("Agent");
    watcher = await member("Watcher");
    const inactive = await member("Inactive", {active: "inactive"});
    const foreign = await member("Foreign", {company: otherCompany});
    await db().collection("propertymanagementconfigs").insertOne({
        company: companyId, notifyOnReservations: [watcher, inactive, foreign, agent], deletedAt: null,
    });
}));

/** An unpaid reservation made by `agent` for `client`, holding its unit, with its last day on `expirationDate`. */
async function seedHeldReservation(expirationDate: string, input: {paid?: boolean} = {}) {
    const unit = await seedUnit(companyId, {price: "250000.00", priceCurrency: chf, status: UnitStatus.RESERVED});
    const reservation = await seedReservation(companyId, {unit, client, paid: input.paid ?? false});
    await db().collection("reservations").updateOne({_id: reservation}, {$set: {expirationDate: new Date(expirationDate), reservedBy: agent}});
    await db().collection("units").updateOne({_id: unit}, {$set: {reservation}});
    return {unit, reservation};
}

const expiredNotices = () => mocks.emit.mock.calls.filter(([code]) => code === "RESERVATION_EXPIRED");
const sorted = (ids: ObjectId[]) => ids.map(String).sort();

describe("an expired reservation tells its agent and the reservation watchers (D112)", {timeout: 60000}, () => {
    it("after the expiry commits, in-app and by email, never the client, and nobody about an expiry that failed", () => asCompany(async () => {
        const ended = await seedHeldReservation("2026-03-01");
        const failing = await seedHeldReservation("2026-03-02");
        const update = reservationService.updateByIdOrThrow.bind(reservationService);
        vi.spyOn(reservationService, "updateByIdOrThrow").mockImplementation((id, ...rest) =>
            new ObjectId(String(id)).equals(failing.reservation) ? Promise.reject(new Error("write failed")) : update(id, ...rest));

        await runReservationExpirationReminders(companyId, undefined, {now});

        expect((await findRaw("reservations", ended.reservation))!.status).toBe("expired");
        expect((await findRaw("reservations", failing.reservation))!.status).toBe("active");

        const notices = expiredNotices();
        expect(notices).toHaveLength(1);
        const [, event] = notices[0];
        expect(event.payload).toMatchObject({reservationId: ended.reservation.toString(), clientName: "Client Test", agentName: "Agent Test"});
        expect([...event.receiverIds].sort()).toEqual(sorted([agent, watcher]));

        const mail = {kind: "reservation_expired", reservationId: ended.reservation.toString()};
        expect(mocks.staffMail.mock.calls.map(([sent]) => sent)).toMatchObject([mail, mail]);
        // The client's "expired" email stays manual.
        expect(mocks.clientEmail.mock.calls.filter(([email]) => email.kind === "expiration_expired")).toHaveLength(0);
    }));
});

describe("staff sending the expired email end the reservation like the cron (TD-B140)", {timeout: 60000}, () => {
    it("ends it once its last day is over in the company's timezone: commission void, unit free, agent told, client emailed", () => asCompany(async () => {
        vi.useFakeTimers({now, toFake: ["Date"]});
        // Its last day, 9 March, is over in Zurich already, though not in UTC.
        const held = await seedHeldReservation("2026-03-09");
        const commission = await Commission.collection.insertOne({
            company: companyId, agent, sourceType: "reservation", sourceId: held.reservation, reservation: held.reservation,
            basis: "depositAmount", basisAmount: dec("5000.00"), ratePercent: 3, amount: dec("150.00"), currency: chf, status: "pending", deletedAt: null,
        });

        await reservations.manualClientEmail({...params, _id: held.reservation.toString(), action: "send_expired"});

        const [reservation, unit] = [(await findRaw("reservations", held.reservation))!, (await findRaw("units", held.unit))!];
        expect([reservation.status, reservation.isActive, unit.status, unit.reservation ?? null]).toEqual(["expired", true, UnitStatus.AVAILABLE, null]);
        expect((await Commission.collection.findOne({_id: commission.insertedId}))!.status).toBe("voided");
        expect(mocks.clientEmail.mock.calls.map(([email]) => email.kind)).toEqual(["expiration_expired"]);
        expect(expiredNotices()).toHaveLength(1);

        // Sending it again only emails: the reservation is not ended twice.
        const expiredAt = reservation.expiredAt;
        await reservations.manualClientEmail({...params, _id: held.reservation.toString(), action: "send_expired"});
        expect((await findRaw("reservations", held.reservation))!.expiredAt).toEqual(expiredAt);
        expect(mocks.clientEmail).toHaveBeenCalledTimes(2);
        expect(expiredNotices()).toHaveLength(1);
    }));

    it("refuses while its last day is today in the company's timezone, and changes nothing", () => asCompany(async () => {
        vi.useFakeTimers({now, toFake: ["Date"]});
        const held = await seedHeldReservation("2026-03-10");

        await expect(reservations.manualClientEmail({...params, _id: held.reservation.toString(), action: "send_expired"}))
            .rejects.toMatchObject({error_code: "manual_reservation_email_action_not_allowed"});
        expect((await findRaw("reservations", held.reservation))!.status).toBe("active");
        expect(mocks.clientEmail).not.toHaveBeenCalled();
    }));
});

describe("payments on a reservation that is no longer active (TD-B141)", {timeout: 60000}, () => {
    it("refuses to pay an expired reservation, which keeps isActive", () => asCompany(async () => {
        const unit = await seedUnit(companyId, {price: "1000.00", priceCurrency: chf});
        const reservationId = await seedReservation(companyId, {unit, client, status: "expired", isActive: true, paid: false});

        await expect(reservations.pay({...params, _id: reservationId.toString()})).rejects.toMatchObject({error_code: "reservation_not_active"});
        expect((await findRaw("reservations", reservationId))!.paid).toBe(false);
    }));

    it("refuses to reverse a payment on an expired reservation", () => asCompany(async () => {
        const unit = await seedUnit(companyId, {price: "1000.00", priceCurrency: chf});
        const reservationId = await seedReservation(companyId, {unit, client, status: "expired", isActive: true, paid: true});

        await expect(reservations.reversePayment({...params, _id: reservationId.toString()})).rejects.toMatchObject({error_code: "reservation_not_active"});
        expect((await findRaw("reservations", reservationId))!.paid).toBe(true);
    }));

    it("still takes the payment of an active one", () => asCompany(async () => {
        const unit = await seedUnit(companyId, {price: "1000.00", priceCurrency: chf, status: UnitStatus.RESERVED});
        const reservationId = await seedReservation(companyId, {unit, client, paid: false});

        await reservations.pay({...params, _id: reservationId.toString()});
        expect((await findRaw("reservations", reservationId))!.paid).toBe(true);
    }));
});
