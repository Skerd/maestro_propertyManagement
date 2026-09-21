import {Decimal128, ObjectId} from "mongodb";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {computeUnitPriceFromEdificeRates} from "./computeUnitPriceFromEdificeRates";
import type {EffectiveRates} from "./resolveEffectiveRates";

/**
 * Reprices units that still follow the sale rates (`priceManuallyEdited: false`) using their floor's
 * effective rates. Floors without an effective unit-area rate are skipped — we never invent prices.
 * Returns the number of repriced units.
 */
export async function cascadeUnitPrices(args: {
    unitFilter: Record<string, unknown>;
    ratesByFloorId: Map<string, EffectiveRates>;
    saleCurrencyId: ObjectId | null;
    reason: string;
    changedBy: ObjectId;
    session: any;
    logger: any;
    languageCode: string;
}): Promise<number> {
    const {unitFilter, ratesByFloorId, saleCurrencyId, reason, changedBy, session, logger, languageCode} = args;

    const derivedUnits = await unitService.find({...unitFilter, priceManuallyEdited: false}, {session, logger, languageCode});
    const changedAt = new Date();
    let repriced = 0;

    for (const unit of derivedUnits) {
        const floorId = ((unit.floor as any)?._id ?? unit.floor)?.toString();
        const rates = floorId ? ratesByFloorId.get(floorId) : undefined;
        if (!rates) continue;

        const computed = computeUnitPriceFromEdificeRates({
            pricePerMeterSquared: rates.pricePerMeterSquared,
            verandaPricePerMeterSquared: rates.verandaPricePerMeterSquared,
            area: unit.area,
            verandaArea: unit.verandaArea,
        });
        if (computed == null) continue;

        const newPrice = Decimal128.fromString(String(computed));
        const $set: Record<string, unknown> = {price: newPrice, priceManuallyEdited: false};
        if (saleCurrencyId) $set.priceCurrency = saleCurrencyId;

        await unitService.updateByIdOrThrow(
            unit._id,
            {
                $set,
                $push: {
                    priceHistory: {
                        price: newPrice,
                        currency: saleCurrencyId ?? ((unit.priceCurrency as any)?._id ?? unit.priceCurrency),
                        changedAt,
                        changedBy,
                        reason,
                    },
                },
            },
            {session, logger, languageCode},
        );
        repriced++;
    }

    return repriced;
}
