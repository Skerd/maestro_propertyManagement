import {describe, expect, it} from "vitest";
import {Decimal128, ObjectId} from "mongodb";
import {saleConversionFields} from "../saleMapper.dto";

const eur = {_id: new ObjectId(), symbol: "€"};
const chf = {_id: new ObjectId(), symbol: "CHF"};
const dec = (value: string) => Decimal128.fromString(value);

type Input = Parameters<typeof saleConversionFields>[0];
const sale = (fields: Record<string, unknown>): Input => fields as Input;

describe("saleConversionFields (TD-B246)", () => {
    it("shows no rate and no converted deposit when every amount is in the sale currency", () => {
        expect(saleConversionFields(sale({
            saleCurrency: eur, listedUnitCurrency: eur, reservationDepositCurrency: eur,
            saleExchangeRate: dec("1"), reservationExchangeRate: dec("1"), reservationConvertedAmount: dec("25000.00"),
        }))).toEqual({saleExchangeRate: undefined, reservationExchangeRate: undefined, reservationConvertedAmount: undefined});
    });

    it("shows each conversion whose two currencies differ", () => {
        expect(saleConversionFields(sale({
            saleCurrency: eur, listedUnitCurrency: chf, reservationDepositCurrency: chf,
            saleExchangeRate: dec("1.05"), reservationExchangeRate: dec("1.05"), reservationConvertedAmount: dec("5250.00"),
        }))).toEqual({saleExchangeRate: 1.05, reservationExchangeRate: 1.05, reservationConvertedAmount: 5250});
    });

    it("compares ids whether the currencies are populated or not, and keeps a rate whose currency is unknown", () => {
        expect(saleConversionFields(sale({
            saleCurrency: eur._id, listedUnitCurrency: eur, reservationDepositCurrency: undefined,
            saleExchangeRate: dec("1"), reservationExchangeRate: dec("0.98"), reservationConvertedAmount: dec("980.00"),
        }))).toEqual({saleExchangeRate: undefined, reservationExchangeRate: 0.98, reservationConvertedAmount: 980});
    });
});
