import {describe, expect, it} from "vitest";
import {pickFloorsFollowingEdifice, resolveEffectiveRates} from "../resolveEffectiveRates";

const edifice = {pricePerMeterSquared: 3000, verandaPricePerMeterSquared: 1000};

describe("resolveEffectiveRates", () => {
    it("follows the edifice when the floor has no rates", () => {
        expect(resolveEffectiveRates({}, edifice)).toEqual({
            pricePerMeterSquared: 3000,
            verandaPricePerMeterSquared: 1000,
            source: {pricePerMeterSquared: "edifice", verandaPricePerMeterSquared: "edifice"},
        });
    });

    it("resolves each rate on its own", () => {
        const rates = resolveEffectiveRates({pricePerMeterSquared: 3500, verandaPricePerMeterSquared: null}, edifice);
        expect(rates.pricePerMeterSquared).toBe(3500);
        expect(rates.verandaPricePerMeterSquared).toBe(1000);
        expect(rates.source).toEqual({pricePerMeterSquared: "floor", verandaPricePerMeterSquared: "edifice"});
    });

    it("treats a floor rate of 0 as an explicit override", () => {
        const rates = resolveEffectiveRates({verandaPricePerMeterSquared: 0}, edifice);
        expect(rates.verandaPricePerMeterSquared).toBe(0);
        expect(rates.source.verandaPricePerMeterSquared).toBe("floor");
    });

    it("returns null when neither level has a rate", () => {
        expect(resolveEffectiveRates(null, {}).pricePerMeterSquared).toBeNull();
    });
});

describe("pickFloorsFollowingEdifice", () => {
    const inheriting = {name: "A"};
    const ownMain = {name: "B", pricePerMeterSquared: 3500};
    const ownBoth = {name: "C", pricePerMeterSquared: 3500, verandaPricePerMeterSquared: 900};
    const floors = [inheriting, ownMain, ownBoth];

    it("skips floors overriding the changed main rate", () => {
        expect(pickFloorsFollowingEdifice(floors, ["pricePerMeterSquared"], false)).toEqual([inheriting]);
    });

    it("keeps floors still inheriting the changed veranda rate", () => {
        expect(pickFloorsFollowingEdifice(floors, ["verandaPricePerMeterSquared"], false)).toEqual([inheriting, ownMain]);
    });

    it("targets every floor on a currency change", () => {
        expect(pickFloorsFollowingEdifice(floors, [], true)).toEqual(floors);
    });
});
