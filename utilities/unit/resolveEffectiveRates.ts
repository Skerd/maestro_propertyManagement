import type {EffectiveRateSource} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/floor.dto";

export type SaleRates = {
    pricePerMeterSquared?: number | null;
    verandaPricePerMeterSquared?: number | null;
};

export type EffectiveRates = {
    pricePerMeterSquared: number | null;
    verandaPricePerMeterSquared: number | null;
    source: {pricePerMeterSquared: EffectiveRateSource; verandaPricePerMeterSquared: EffectiveRateSource};
};

export const RATE_FIELDS = ["pricePerMeterSquared", "verandaPricePerMeterSquared"] as const;
export type RateField = typeof RATE_FIELDS[number];

const asRate = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** A floor rate overrides the edifice rate; an empty floor rate follows the edifice. Each rate resolves on its own. */
export function resolveEffectiveRates(floor: SaleRates | null | undefined, edifice: SaleRates | null | undefined): EffectiveRates {
    const out = {source: {}} as EffectiveRates;
    for (const field of RATE_FIELDS) {
        const floorRate = asRate(floor?.[field]);
        out[field] = floorRate ?? asRate(edifice?.[field]);
        out.source[field] = floorRate != null ? "floor" : "edifice";
    }
    return out;
}

/**
 * Floors affected by an edifice pricing change: those inheriting at least one changed rate.
 * A currency change affects every floor, since currency always comes from the edifice.
 */
export function pickFloorsFollowingEdifice<T extends SaleRates>(floors: T[], changedFields: RateField[], currencyChanged: boolean): T[] {
    if (currencyChanged) return floors;
    return floors.filter((floor) => changedFields.some((field) => asRate(floor[field]) == null));
}
