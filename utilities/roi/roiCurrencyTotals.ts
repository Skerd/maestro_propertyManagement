import type {RoiCurrencyTotals, RoiMoney} from "armonia/src/modules/propertyManagement/api/realEstate/private/roi/roi.response.type";
import {minorToNumber, sumMinor, toMinor} from "armonia/src/modules/core/helpers/money";
import type {UnitCostCurrencyTotal} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.dto";

/** A unit's sale price or one currency of its costs. */
export type RoiCurrencyAmount = UnitCostCurrencyTotal;

/**
 * A unit's net profit and ROI (TD-B223): the sale price minus the costs, only when every cost is in the sale's
 * currency, since amounts in different currencies are never subtracted (GLB-08, UX-07). A sale without costs keeps its
 * full price and has no ROI. The profit carries the precision it is exact at, so it is shown at the currency's decimals
 * (TD-F103); the caller adds the symbol it may show.
 */
export function unitNetProfit(sale: RoiCurrencyAmount | undefined, costs: RoiCurrencyAmount[]): {netProfit?: RoiMoney; roiPercent?: number} {
    if (!sale || costs.some((cost) => cost.currencyId !== sale.currencyId)) return {};
    const decimals = Math.max(sale.decimals, ...costs.map((cost) => cost.decimals));
    const costMinor = sumMinor(costs.map((cost) => toMinor(cost.amount, decimals)));
    const amount = minorToNumber(toMinor(sale.amount, decimals) - costMinor, decimals);
    const totalCosts = minorToNumber(costMinor, decimals);
    return {netProfit: {amount, decimals}, roiPercent: totalCosts > 0 ? (amount / totalCosts) * 100 : undefined};
}

/**
 * A unit's annual gross yield in percent (TD-B227): a year of rent over the sale price, only when the rent and the sale
 * are in one currency, since a rent in francs over a price in euros is no yield (GLB-08). A ratio, so plain division.
 */
export function unitGrossYield(sale: RoiCurrencyAmount | undefined, rent: Pick<RoiCurrencyAmount, "currencyId" | "amount"> | undefined): number | undefined {
    if (!sale || !rent || rent.currencyId !== sale.currencyId || !rent.amount || sale.amount <= 0) return undefined;
    return ((rent.amount * 12) / sale.amount) * 100;
}

/**
 * The scope's revenue, costs and net profit per currency (TD-B223), each summed exactly at that currency's precision.
 * Ordered by symbol, so no currency is ranked against another (UX-07).
 */
export function roiTotalsByCurrency(units: {sale?: RoiCurrencyAmount; costs: RoiCurrencyAmount[]}[]): RoiCurrencyTotals[] {
    const byCurrency = new Map<string, {symbol?: string; revenue: RoiCurrencyAmount[]; costs: RoiCurrencyAmount[]}>();
    const entryOf = (amount: RoiCurrencyAmount) => {
        const entry = byCurrency.get(amount.currencyId) ?? {revenue: [], costs: []};
        entry.symbol ??= amount.currencySymbol;
        byCurrency.set(amount.currencyId, entry);
        return entry;
    };
    for (const unit of units) {
        if (unit.sale) entryOf(unit.sale).revenue.push(unit.sale);
        for (const cost of unit.costs) entryOf(cost).costs.push(cost);
    }

    const totals: RoiCurrencyTotals[] = [...byCurrency.values()].map((entry) => {
        const decimals = Math.max(...[...entry.revenue, ...entry.costs].map((amount) => amount.decimals));
        const revenueMinor = sumMinor(entry.revenue.map((amount) => toMinor(amount.amount, decimals)));
        const costMinor = sumMinor(entry.costs.map((amount) => toMinor(amount.amount, decimals)));
        const totalCosts = minorToNumber(costMinor, decimals);
        const netProfit = minorToNumber(revenueMinor - costMinor, decimals);
        return {
            decimals,
            currencySymbol: entry.symbol,
            totalRevenue: minorToNumber(revenueMinor, decimals),
            totalCosts,
            netProfit,
            roiPercent: totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0,
        };
    });
    // Code-point order keeps the list the same on every server locale; a currency without a readable symbol goes last.
    const key = (total: RoiCurrencyTotals) => total.currencySymbol ?? "\uffff";
    return totals.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
