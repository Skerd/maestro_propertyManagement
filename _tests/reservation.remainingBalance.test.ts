/** GLB-08: the reservation's remaining balance is exact money, and the "When" quick filter counts from the company's today. */
import {describe, expect, it} from "vitest";
import {Decimal128, ObjectId} from "mongodb";
import {computeReservationFinancialFields} from "@propertyManagement/utilities/mappers/reservation/reservationMapper.dto";
import {reservationWhenCondition} from "@propertyManagement/utilities/reservation/reservationExpirationCalendar";

const chf = {_id: new ObjectId(), symbol: "CHF", decimalPlaces: 2};
const jpy = {_id: new ObjectId(), symbol: "¥", decimalPlaces: 0};

const reservation = (input: {price?: string; deposit?: string; paid?: boolean; currency?: typeof chf; depositCurrency?: ObjectId}) => ({
    paid: input.paid ?? false,
    unit: {_id: new ObjectId(), ...(input.price != null ? {price: Decimal128.fromString(input.price)} : {}), priceCurrency: input.currency ?? chf},
    ...(input.deposit != null ? {depositAmount: Decimal128.fromString(input.deposit)} : {}),
    depositCurrency: input.depositCurrency ?? (input.currency ?? chf)._id,
});

describe("reservation remaining balance (GLB-08)", () => {
    it("takes the deposit off the price without float drift", () => {
        // 0.3 - 0.1 is 0.19999999999999998 in floats.
        expect(computeReservationFinancialFields(reservation({price: "0.30", deposit: "0.10"})).remainingBalance).toBe(0.2);
        expect(computeReservationFinancialFields(reservation({price: "150000.10", deposit: "5000.05"})).remainingBalance).toBe(145000.05);
    });

    it("rounds once to the unit currency's precision", () => {
        expect(computeReservationFinancialFields(reservation({price: "1000", deposit: "333.6", currency: jpy})).remainingBalance).toBe(666);
    });

    it("never goes below zero", () => {
        expect(computeReservationFinancialFields(reservation({price: "100.00", deposit: "150.00"})).remainingBalance).toBe(0);
    });

    it("leaves the balance out when the deposit is in another currency or the price is missing", () => {
        expect(computeReservationFinancialFields(reservation({price: "100.00", deposit: "10.00", depositCurrency: new ObjectId()})).remainingBalance).toBeUndefined();
        expect(computeReservationFinancialFields(reservation({deposit: "10.00"})).remainingBalance).toBeUndefined();
    });

    it("reads the payment state from paid and the deposit", () => {
        expect(computeReservationFinancialFields(reservation({price: "100", paid: true})).reservationFinancialPaymentState).toBe("fullyPaid");
        expect(computeReservationFinancialFields(reservation({price: "100", deposit: "0.01"})).reservationFinancialPaymentState).toBe("partiallyPaid");
        expect(computeReservationFinancialFields(reservation({price: "100", deposit: "0"})).reservationFinancialPaymentState).toBe("unpaid");
    });
});

describe("reservation \"When\" quick filter", () => {
    it("expiring soon runs from today through the reminder window", () => {
        expect(reservationWhenCondition("expiring_soon", "2026-12-30")).toEqual({expirationDate: {$gte: "2026-12-30", $lte: "2027-01-02"}});
    });

    it("expired is any day before today", () => {
        expect(reservationWhenCondition("expired", "2026-11-12")).toEqual({expirationDate: {$lt: "2026-11-12"}});
    });
});
