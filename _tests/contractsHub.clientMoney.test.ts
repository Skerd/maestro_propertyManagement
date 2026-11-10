/** D127 / TD-B171: a reserved client row's paid is the deposit once paid, else 0; remaining is the price less that. */
import {describe, expect, it} from "vitest";
import {Decimal128, ObjectId} from "mongodb";
import {buildClientRegistryRows} from "@propertyManagement/utilities/contractsHub/contractsHubMapper.dto";

const chf = {_id: new ObjectId(), name: "Swiss franc", symbol: "CHF", abbreviation: "CHF", decimalPlaces: 2};
const eur = new ObjectId();

const reservation = (input: {paid: boolean; depositAmount?: string; depositCurrency?: ObjectId; price?: string}) => ({
    _id: new ObjectId(),
    client: {_id: new ObjectId(), name: "Ana"},
    unit: {_id: new ObjectId(), ...(input.price != null ? {price: Decimal128.fromString(input.price)} : {}), priceCurrency: chf},
    reservationDate: "2026-06-01",
    paid: input.paid,
    ...(input.depositAmount != null ? {depositAmount: Decimal128.fromString(input.depositAmount)} : {}),
    depositCurrency: input.depositCurrency ?? chf._id,
});

const moneyOf = (row: ReturnType<typeof reservation>) => {
    const [client] = buildClientRegistryRows([], [row]);
    return {paid: client.paid, remaining: client.remaining, unitValue: client.unitValue};
};

describe("contracts hub reserved client money (D127)", () => {
    it("counts a paid deposit as paid and takes it off the price", () => {
        expect(moneyOf(reservation({paid: true, depositAmount: "5000.10", price: "150000.00"})))
            .toEqual({paid: 5000.1, remaining: 144999.9, unitValue: 150000});
    });

    it("counts nothing as paid while the deposit is unpaid", () => {
        expect(moneyOf(reservation({paid: false, depositAmount: "5000.10", price: "150000.00"})))
            .toEqual({paid: 0, remaining: 150000, unitValue: 150000});
    });

    it("shows no paid or remaining for a paid deposit in another currency than the price", () => {
        expect(moneyOf(reservation({paid: true, depositAmount: "5000.00", depositCurrency: eur, price: "150000.00"})))
            .toEqual({paid: undefined, remaining: undefined, unitValue: 150000});
    });

    it("shows the paid deposit without a remaining when the unit has no price", () => {
        expect(moneyOf(reservation({paid: true, depositAmount: "5000.00"})))
            .toEqual({paid: 5000, remaining: undefined, unitValue: undefined});
    });
});
