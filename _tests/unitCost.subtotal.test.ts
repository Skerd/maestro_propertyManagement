/** TD-B202: a unit cost's subtotal rounds each line at its currency's precision, not always at cents (GLB-08). */
import {describe, expect, it} from "vitest";
import {Decimal128} from "mongodb";
import {computeUnitCostSubtotal} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.dto";

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
