import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {ReservationActions} from "@propertyManagement/database/schemas/reservation/reservation.actions";
import {CommissionActions} from "@propertyManagement/database/schemas/commission/commission.actions";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {allPermissionTags} from "@coreModule/_tests/httpHarness";
import {actor, asTenant, clearDatabase, dec, findRaw, seedCurrency, seedReservation, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const params = actor(companyId, allPermissionTags([Commission]));
const reservations = new ReservationActions();
const commissions = new CommissionActions();

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

let currency: ObjectId;
let client: ObjectId;

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    currency = await seedCurrency(companyId, "CHF");
    client = await seedUser(companyId);
}));

describe("reservation cancel and reinstate", {timeout: 60000}, () => {
    it.each(["expired", "cancelled", "converted"])("refuses to cancel a reservation that is %s", (status) => asCompany(async () => {
        const unitId = await seedUnit(companyId, {price: "1000.00", priceCurrency: currency});
        const reservationId = await seedReservation(companyId, {unit: unitId, client, status, paid: false});
        await expect(reservations.cancel({...params, _id: reservationId.toString(), cancellationReason: "No longer interested"}))
            .rejects.toMatchObject({error_code: "reservation_not_active"});
        expect((await findRaw("reservations", reservationId))!.status).toBe(status);
    }));

    it("cancels an active one and frees its unit", () => asCompany(async () => {
        const unitId = await seedUnit(companyId, {price: "1000.00", priceCurrency: currency, status: UnitStatus.RESERVED});
        const reservationId = await seedReservation(companyId, {unit: unitId, client, paid: false});
        await mongoose.connection.db!.collection("units").updateOne({_id: unitId}, {$set: {reservation: reservationId}});

        await reservations.cancel({...params, _id: reservationId.toString(), cancellationReason: "No longer interested"});
        const [reservation, unit] = [await findRaw("reservations", reservationId), await findRaw("units", unitId)];
        expect([reservation!.status, reservation!.isActive, unit!.status, unit!.reservation ?? null]).toEqual(["cancelled", false, UnitStatus.AVAILABLE, null]);
    }));

    it("reinstates onto an available unit only, clearing when it had expired and when it was cancelled", () => asCompany(async () => {
        const soldUnit = await seedUnit(companyId, {price: "1000.00", priceCurrency: currency, status: UnitStatus.SOLD});
        const onSold = await seedReservation(companyId, {unit: soldUnit, client, status: "cancelled", isActive: false});
        await expect(reservations.reinstate({...params, _id: onSold.toString()})).rejects.toMatchObject({error_code: "unit_not_available_for_reactivation"});
        expect((await findRaw("units", soldUnit))!.reservation ?? null).toBeNull();

        const freeUnit = await seedUnit(companyId, {price: "1000.00", priceCurrency: currency});
        const reservationId = await seedReservation(companyId, {unit: freeUnit, client, status: "cancelled", isActive: false});
        await mongoose.connection.db!.collection("reservations")
            .updateOne({_id: reservationId}, {$set: {expiredAt: new Date("2026-02-01"), cancelledAt: new Date("2026-02-02")}});

        await reservations.reinstate({...params, _id: reservationId.toString()});
        const [reservation, unit] = [await findRaw("reservations", reservationId), await findRaw("units", freeUnit)];
        expect([reservation!.status, reservation!.expiredAt ?? null, reservation!.cancelledAt ?? null]).toEqual(["active", null, null]);
        expect([unit!.status, String(unit!.reservation)]).toEqual([UnitStatus.RESERVED, reservationId.toString()]);
    }));
});

describe("paying a commission", {timeout: 60000}, () => {
    async function seedCommission(status: string) {
        const agent = await seedUser(companyId, "Agent");
        const created = await Commission.collection.insertOne({
            company: companyId, agent, sourceType: "sale", sourceId: new ObjectId(), basis: "finalPrice", basisAmount: dec("100000.00"),
            ratePercent: 3, amount: dec("3000.00"), currency, status, deletedAt: null,
        });
        return created.insertedId;
    }

    it("needs an approved commission", () => asCompany(async () => {
        const pending = await seedCommission("pending");
        await expect(commissions.markPaid({...params, _id: pending.toString()})).rejects.toMatchObject({error_code: "commission_not_approved"});
        expect((await findRaw("commissions", pending))!.status).toBe("pending");

        const approved = await seedCommission("approved");
        await commissions.markPaid({...params, _id: approved.toString(), paymentReference: "BANK-1"});
        expect((await findRaw("commissions", approved))!.status).toBe("paid");
    }));

    it("refuses splits that add up to more than the commission, to the cent", () => asCompany(async () => {
        const id = await seedCommission("pending");
        const agent = (await seedUser(companyId, "Second")).toString();
        await expect(commissions.setSplits({...params, _id: id.toString(), splits: [
            {agentId: agent, ratePercent: 50, amount: 1500.01}, {agentId: agent, ratePercent: 50, amount: 1500},
        ]})).rejects.toMatchObject({error_code: "commission_splits_exceed_total"});
        await commissions.setSplits({...params, _id: id.toString(), splits: [
            {agentId: agent, ratePercent: 50, amount: 1500}, {agentId: agent, ratePercent: 50, amount: 1500},
        ]});
        expect((await findRaw("commissions", id))!.splits).toHaveLength(2);
    }));
});
