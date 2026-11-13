/**
 * TD-B202: a unit cost's subtotal rounds each line at its currency's precision, not always at cents (GLB-08).
 * TD-B213: the ROI totals of a unit's costs are summed per currency at that precision.
 */
import {describe, expect, it} from "vitest";
import {Decimal128} from "mongodb";
import {ObjectId} from "mongodb";
import {computeUnitCostSubtotal, unitCostTotalsByUnit} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.dto";

const line = (amount: number, pricePerUnit: string) => ({amount, pricePerUnit: Decimal128.fromString(pricePerUnit)});

describe("unit cost subtotal", () => {
    it("rounds each line at the currency's decimal places", () => {
        const expenditureItems = [line(3, "1.0005"), line(2, "0.3333")];
        expect(computeUnitCostSubtotal({expenditureItems, currency: {_id: "kwd", decimalPlaces: 3}})).toBe(3.669);
        expect(computeUnitCostSubtotal({expenditureItems, currency: {_id: "jpy", decimalPlaces: 0}})).toBe(3);
    });

    it("rounds at cents while the currency is only an id", () => {
        expect(computeUnitCostSubtotal({expenditureItems: [line(3, "1.0005")], currency: "507f1f77bcf86cd799439011"})).toBe(3);
        expect(computeUnitCostSubtotal({expenditureItems: [line(10, "1.005")]})).toBe(10.1);
    });
});

describe("unit cost totals per unit", () => {
    const kwd = {_id: new ObjectId(), symbol: "KD", decimalPlaces: 3};
    const eur = {_id: new ObjectId(), symbol: "€", decimalPlaces: 2};
    const unitA = new ObjectId();
    const unitB = new ObjectId();

    it("sums each unit's costs in their currency's minor units, keeping its symbol", () => {
        const totals = unitCostTotalsByUnit([
            {unit: unitA, currency: kwd, expenditureItems: [line(3, "1.0005")]},
            {unit: unitA, currency: kwd, expenditureItems: [line(1, "0.0016")]},
            {unit: unitB, currency: eur, expenditureItems: [line(10, "1.005")]},
        ]);
        expect(totals.get(unitA.toString())).toEqual({amount: 3.005, decimals: 3, currencySymbol: "KD", mixedCurrencies: false});
        expect(totals.get(unitB.toString())).toEqual({amount: 10.1, decimals: 2, currencySymbol: "€", mixedCurrencies: false});
    });

    it("adds a unit's costs in several currencies at the finest precision, naming none", () => {
        const totals = unitCostTotalsByUnit([
            {unit: {_id: unitA}, currency: kwd, expenditureItems: [line(1, "1.001")]},
            {unit: {_id: unitA}, currency: eur, expenditureItems: [line(1, "2.50")]},
        ]);
        expect(totals.get(unitA.toString())).toEqual({amount: 3.501, decimals: 3, mixedCurrencies: true});
    });

    it("rounds at cents while the currency is only an id", () => {
        const totals = unitCostTotalsByUnit([{unit: unitA, currency: kwd._id, expenditureItems: [line(3, "1.0005")]}]);
        expect(totals.get(unitA.toString())).toEqual({amount: 3, decimals: 2, currencySymbol: undefined, mixedCurrencies: false});
    });
});
