import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// The buyer's and the watchers' emails are not what these tests are about.
vi.mock("@propertyManagement/utilities/database/sale/saleClientEmailDispatch", async (importOriginal) => ({
    ...await importOriginal<object>(),
    dispatchSaleClientEmail: vi.fn(async () => false),
}));
vi.mock("@propertyManagement/utilities/sale/salesStaffNotify", async (importOriginal) => ({
    ...await importOriginal<object>(),
    notifySalesWatchers: vi.fn(async () => 0),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as saleRoute from "@propertyManagement/api/realEstate/private/unit/sale";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {asTenant, clearDatabase, decString, findRaw, seedCurrency, seedReservedUnit, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const app = appFor([{...saleRoute, module: "propertyManagement"}]);

let admin: TestCaller;
let chf: ObjectId;
let eur: ObjectId;
let buyer: ObjectId;
let seller: ObjectId;

beforeAll(async () => {
    await connectTestDatabase();
    admin = {
        userId: new ObjectId().toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([Sale, PaymentPlan, Unit, Reservation, Commission]),
    };
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await clearDatabase();
    chf = await seedCurrency(companyId, "CHF");
    eur = await seedCurrency(companyId, "EUR");
    buyer = await seedUser(companyId, "Buyer");
    seller = await seedUser(companyId, "Seller");
}));

const createSale = (body: Record<string, unknown>) => request(app).put("/api/realEstate/unit/sale").set(callerHeader(admin)).send({
    paymentType: "cash", soldBy: seller.toString(), buyer: buyer.toString(), saleDate: "2026-03-01", saleCurrency: chf.toString(), ...body,
});

const storedSale = (id: string) => asCompany(async () => (await Sale.findById(id).lean())!);

describe("sale price (one rule for the server and the form preview)", {timeout: 60000}, () => {
    it("deducts a same-currency deposit after the discount", async () => {
        const {unitId, reservationId} = await asCompany(() => seedReservedUnit(companyId, {price: "250000.00", priceCurrency: chf, depositAmount: "5000.00", depositCurrency: chf, client: buyer}));
        const response = await createSale({unit: unitId.toString(), localDiscount: 2});
        expect(response.status).toBe(200);

        const sale = await storedSale(response.body._id);
        expect([decString(sale.finalPrice), decString(sale.reservationConvertedAmount), sale.reservationExchangeRate]).toEqual(["240000.00", "5000.00", undefined]);
        const unit = await findRaw("units", unitId);
        const reservation = await findRaw("reservations", reservationId);
        expect([unit!.status, String(unit!.sale), reservation!.status]).toEqual([UnitStatus.SOLD, response.body._id, "converted"]);
    });

    it("converts a deposit paid in another currency with the reservation rate, and asks for that rate", async () => {
        const {unitId} = await asCompany(() => seedReservedUnit(companyId, {price: "250000.00", priceCurrency: chf, depositAmount: "5000.00", depositCurrency: eur, client: buyer}));

        const missing = await createSale({unit: unitId.toString()});
        expect([missing.status, missing.body.error_code]).toEqual([400, "reservation_exchange_rate_required"]);

        const response = await createSale({unit: unitId.toString(), reservationExchangeRate: "0.9412"});
        expect(response.status).toBe(200);
        const sale = await storedSale(response.body._id);
        expect([decString(sale.finalPrice), decString(sale.reservationConvertedAmount), decString(sale.reservationExchangeRate)])
            .toEqual(["245294.00", "4706.00", "0.9412"]);
    });

    it("converts a unit priced in another currency and still deducts a deposit in the sale currency", async () => {
        const {unitId} = await asCompany(() => seedReservedUnit(companyId, {price: "100000.00", priceCurrency: eur, depositAmount: "1000.00", depositCurrency: chf, client: buyer}));

        const missing = await createSale({unit: unitId.toString()});
        expect([missing.status, missing.body.error_code]).toEqual([400, "sale_exchange_rate_required"]);

        const response = await createSale({unit: unitId.toString(), saleExchangeRate: "0.95"});
        expect(response.status).toBe(200);
        const sale = await storedSale(response.body._id);
        expect([decString(sale.finalPrice), decString(sale.saleExchangeRate)]).toEqual(["94000.00", "0.95"]);
    });

    it("keeps a discount typed as an amount exact when the percentage arrives unrounded", async () => {
        const unitId = await asCompany(() => seedUnit(companyId, {price: "150000.00", priceCurrency: chf}));
        const response = await createSale({unit: unitId.toString(), localDiscount: (5000 / 150000) * 100});
        expect(response.status).toBe(200);
        expect(decString((await storedSale(response.body._id)).finalPrice)).toBe("145000.00");
    });

    it("refuses a deposit larger than the price, and a sale over an unpaid reservation", async () => {
        const {unitId} = await asCompany(() => seedReservedUnit(companyId, {price: "1000.00", priceCurrency: chf, depositAmount: "1000.01", depositCurrency: chf, client: buyer}));
        const negative = await createSale({unit: unitId.toString()});
        expect([negative.status, negative.body.error_code]).toEqual([400, "final_price_cannot_be_negative"]);

        await asCompany(() => Reservation.collection.updateMany({unit: unitId}, {$set: {paid: false}}));
        const unpaid = await createSale({unit: unitId.toString()});
        expect([unpaid.status, unpaid.body.error_code]).toEqual([400, "unit_already_reserved_and_unpaid"]);
        expect((await findRaw("units", unitId))!.status).toBe(UnitStatus.RESERVED);
    });

    it("records the commission as an exact percentage of the final price", async () => {
        const unitId = await asCompany(() => seedUnit(companyId, {price: "123456.78", priceCurrency: chf, saleCommissionRatePercent: 2.5}));
        const response = await createSale({unit: unitId.toString()});
        expect(response.status).toBe(200);
        const commission = await asCompany(async () => (await Commission.findOne({sourceId: new ObjectId(response.body._id)}).lean())!);
        // 2.5 % of 123,456.78 = 3,086.4195 → 3,086.42
        expect([decString(commission.amount), commission.status]).toEqual(["3086.42", "pending"]);
    });

    it("refuses a payment plan whose installments leave principal unpaid", async () => {
        const unitId = await asCompany(() => seedUnit(companyId, {price: "10000.00", priceCurrency: chf}));
        const response = await createSale({
            unit: unitId.toString(), paymentType: "payment_plan", downPayment: 2000, interestRate: 0, numberOfInstallments: 2,
            startDate: "2026-03-01", endDate: "2026-05-01",
            installments: [{installmentNumber: 1, dueDate: "2026-04-01", amount: 4000}, {installmentNumber: 2, dueDate: "2026-05-01", amount: 3999.99}],
        });
        expect([response.status, response.body.error_code]).toEqual([400, "payment_plan_principal_not_covered"]);
    });
});

describe("rejecting and deleting a sale release what it did", {timeout: 60000}, () => {
    async function sellReservedUnitOnPlan() {
        const {unitId, reservationId} = await asCompany(() => seedReservedUnit(companyId, {price: "10000.00", priceCurrency: chf, depositAmount: "1000.00", depositCurrency: chf, client: buyer}));
        await asCompany(() => Unit.collection.updateOne({_id: unitId}, {$set: {saleCommissionRatePercent: 3}}));
        const response = await createSale({
            unit: unitId.toString(), paymentType: "payment_plan", downPayment: 1000, interestRate: 0, numberOfInstallments: 2,
            startDate: "2026-03-01", endDate: "2026-05-01",
            installments: [{installmentNumber: 1, dueDate: "2026-04-01", amount: 4000}, {installmentNumber: 2, dueDate: "2026-05-01", amount: 4000}],
        });
        expect(response.status).toBe(200);
        const sale = await storedSale(response.body._id);
        return {unitId, reservationId, saleId: sale._id, planId: sale.paymentPlan as unknown as ObjectId};
    }

    async function expectReleased(unitId: ObjectId, reservationId: ObjectId, saleId: ObjectId, planId: ObjectId) {
        const [unit, reservation, plan, commission] = await asCompany(async () => [
            await findRaw("units", unitId),
            await findRaw("reservations", reservationId),
            await findRaw("paymentplans", planId),
            await Commission.collection.findOne({sourceId: saleId}),
        ]);
        expect([unit!.status, unit!.sale ?? null, String(unit!.reservation)]).toEqual([UnitStatus.RESERVED, null, reservationId.toString()]);
        expect(reservation!.status).toBe("active");
        expect(plan!.status).toBe("cancelled");
        expect(commission!.status).toBe("voided");
        return plan!;
    }

    it("rejecting gives the unit back to its reservation, cancels the plan and voids the commission", async () => {
        await asCompany(() => mongoose.connection.db!.collection("propertymanagementconfigs").insertOne({company: companyId, requiresSaleApproval: true, deletedAt: null}));
        const {unitId, reservationId, saleId, planId} = await sellReservedUnitOnPlan();
        expect((await storedSale(saleId.toString())).approvalStatus).toBe("pending_approval");

        const rejected = await request(app).post("/api/realEstate/unit/sale/approveSale").set(callerHeader(admin)).send({_id: saleId.toString(), decision: "rejected"});
        expect(rejected.status).toBe(200);
        await expectReleased(unitId, reservationId, saleId, planId);

        // Deleting the rejected sale later releases nothing twice.
        const deleted = await request(app).delete("/api/realEstate/unit/sale").set(callerHeader(admin)).send({_id: saleId.toString()});
        expect(deleted.status).toBe(200);
        expect((await findRaw("units", unitId))!.status).toBe(UnitStatus.RESERVED);
    });

    it("deleting does the same, takes the plan with it, and restoring takes the sale back", async () => {
        const {unitId, reservationId, saleId, planId} = await sellReservedUnitOnPlan();

        const deleted = await request(app).delete("/api/realEstate/unit/sale").set(callerHeader(admin)).send({_id: saleId.toString()});
        expect(deleted.status).toBe(200);
        const plan = await expectReleased(unitId, reservationId, saleId, planId);
        expect(plan.deletedAt).toBeInstanceOf(Date);

        const restored = await request(app).patch("/api/realEstate/unit/sale/restore").set(callerHeader(admin)).send({_id: saleId.toString()});
        expect(restored.status).toBe(200);
        const [unit, reservation, restoredPlan, commission] = await asCompany(async () => [
            await findRaw("units", unitId),
            await findRaw("reservations", reservationId),
            await findRaw("paymentplans", planId),
            await Commission.collection.findOne({sourceId: saleId}),
        ]);
        expect([unit!.status, String(unit!.sale), reservation!.status]).toEqual([UnitStatus.SOLD, saleId.toString(), "converted"]);
        expect([restoredPlan!.status, restoredPlan!.deletedAt ?? null]).toEqual(["active", null]);
        expect(commission!.status).toBe("pending");
    });
});
