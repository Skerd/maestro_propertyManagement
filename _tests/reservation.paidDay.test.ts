/**
 * A reservation records the day its deposit was paid (TD-B178): `pay` stamps the company's today, `reversePayment`
 * clears it, and the dashboard's "Collected" counts a paid deposit on that day whether the reservation is still active
 * or not (a reservation paid before it recorded a day counts on its reservation day).
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// What is sent is recorded, not delivered.
vi.mock("@coreModule/domain/notifications/notificationEventBus", async (importOriginal) => ({
    ...await importOriginal<object>(),
    emitNotificationEvent: vi.fn(),
}));
vi.mock("@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchReservationClientEmail: vi.fn().mockResolvedValue(true),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as dashboardRoute from "@propertyManagement/api/realEstate/private/dashboard";
import {ReservationActions} from "@propertyManagement/database/schemas/reservation/reservation.actions";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, clearDatabase, findRaw, seedCompany, seedCurrency, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;
const reservations = new ReservationActions();
const params = actor(companyId);
const app = appFor([{...dashboardRoute, module: "propertyManagement"}]);

let chf: ObjectId;
let client: ObjectId;

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    vi.useRealTimers();
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    vi.useRealTimers();
    await clearDatabase();
    await seedCompany(companyId, "Europe/Zurich");
    chf = await seedCurrency(companyId, "CHF");
    client = await seedUser(companyId, "Client");
}));

describe("the reservation's paid day", {timeout: 60000}, () => {
    it("is the company's today when the deposit is paid, and is cleared when the payment is reversed", () => asCompany(async () => {
        // 00:30 on 10 March in Zurich, still 9 March in UTC.
        vi.useFakeTimers({toFake: ["Date"], now: new Date("2026-03-09T23:30:00.000Z")});
        const unit = await seedUnit(companyId, {price: "1000.00", priceCurrency: chf, status: UnitStatus.RESERVED});
        const reservationId = await seedReservation(companyId, {unit, client, paid: false, depositAmount: "100.00", depositCurrency: chf});

        await reservations.pay({...params, _id: reservationId.toString()});
        expect(await findRaw("reservations", reservationId)).toMatchObject({paid: true, paidDate: "2026-03-10"});

        await reservations.reversePayment({...params, _id: reservationId.toString()});
        const reversed = await findRaw("reservations", reservationId);
        expect(reversed?.paid).toBe(false);
        expect(reversed).not.toHaveProperty("paidDate");
    }));
});

describe("Collected counts reservation deposits on their paid day (TD-B178)", {timeout: 60000}, () => {
    const manager = (): TestCaller => ({
        userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true,
        permissions: allPermissionTags([Unit, Sale, PaymentPlan, Reservation]),
    });
    const collected = async (from: string, to: string) => {
        const res = await request(app).post("/api/realEstate/dashboard").set(callerHeader(manager())).send({from, to});
        expect(res.status).toBe(200);
        return (res.body.summary.collected as {currencyId: string; value: number}[]).map(({currencyId, value}) => [currencyId, value]);
    };

    it("counts a cancelled or converted reservation's paid deposit in the period it was paid, and not outside it", () => asCompany(async () => {
        vi.useFakeTimers({toFake: ["Date"], now: new Date("2026-04-15T10:00:00.000Z")});
        // Reserved 10 January (the fixture's day), paid 5 February, cancelled since.
        const cancelled = await seedReservation(companyId, {
            unit: await seedUnit(companyId, {price: "1000.00", priceCurrency: chf}),
            client, paid: true, isActive: false, status: "cancelled", depositAmount: "1000.00", depositCurrency: chf,
        });
        await db().collection("reservations").updateOne({_id: cancelled}, {$set: {paidDate: "2026-02-05"}});
        // Converted to a sale; paid before reservations recorded a paid day, so it counts on its reservation day.
        await seedReservation(companyId, {
            unit: await seedUnit(companyId, {price: "1000.00", priceCurrency: chf, status: UnitStatus.SOLD}),
            client, paid: true, isActive: false, status: "converted", depositAmount: "250.50", depositCurrency: chf,
        });
        // Unpaid: never collected.
        await seedReservation(companyId, {
            unit: await seedUnit(companyId, {price: "1000.00", priceCurrency: chf, status: UnitStatus.RESERVED}),
            client, paid: false, depositAmount: "999.00", depositCurrency: chf,
        });

        expect(await collected("2026-02-01", "2026-02-28")).toEqual([[chf.toString(), 1000]]);
        expect(await collected("2026-01-01", "2026-01-31")).toEqual([[chf.toString(), 250.5]]);
        expect(await collected("2026-03-01", "2026-03-31")).toEqual([]);
    }));
});
