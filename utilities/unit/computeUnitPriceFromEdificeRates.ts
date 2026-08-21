export function computeUnitPriceFromEdificeRates(args: {pricePerMeterSquared: number | null | undefined; verandaPricePerMeterSquared?: number | null; area: number; verandaArea?: number | null;}): number | null {
    const {pricePerMeterSquared, verandaPricePerMeterSquared, area, verandaArea} = args;
    if (typeof pricePerMeterSquared !== "number") return null;
    const verandaComponent = typeof verandaPricePerMeterSquared === "number" ? verandaPricePerMeterSquared * (verandaArea || 0) : 0;
    return pricePerMeterSquared * (area || 0) + verandaComponent;
}
