import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {DEFAULT_DECIMAL_PLACES, minorToNumber, type MoneyInput, toMinor} from "armonia/src/modules/core/helpers/money";
import type {EdificeMoneyByCurrency} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto";
import type {RevenueByCurrency} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.response.type";

/**
 * Money totals of the propertyManagement statistics and dashboard, one per currency id, exact (GLB-08, TD-B166):
 * minor units at the currency's decimals, added as bigints and turned into a number only on the wire. Amounts in two
 * currencies are never added together.
 */
export type MoneyTotals = Map<string, {currency: CurrencySimple; decimals: number; minor: bigint}>;

/**
 * One money line of an aggregate: the `$group` currency id, the looked-up currency fields and a `$toDecimal` sum. A
 * line without a currency is left out, since its amount cannot be added to any total.
 */
export type AggregateMoneyLine = {
    currencyId?: unknown;
    currencyName?: string;
    currencySymbol?: string;
    currencyAbbreviation?: string;
    currencyDecimalPlaces?: number;
    value?: unknown;
};

/** The `$push` / `$project` fields of an {@link AggregateMoneyLine}, from a `$lookup` of the currency as `info`. */
export function aggregateCurrencyFields(info: string): Record<string, unknown> {
    return {
        currencyName: {$ifNull: [`$${info}.name`, ""]},
        currencySymbol: {$ifNull: [`$${info}.symbol`, ""]},
        currencyAbbreviation: {$ifNull: [`$${info}.abbreviation`, ""]},
        currencyDecimalPlaces: `$${info}.decimalPlaces`,
    };
}

/** Adds `amount` in `currency` to its total, rounded once at the currency's decimals (D90). */
export function addMoney(totals: MoneyTotals, currency: CurrencySimple, amount: MoneyInput): void {
    const entry = totals.get(currency._id);
    if (entry) {
        entry.minor += toMinor(amount, entry.decimals);
        return;
    }
    const decimals = currency.decimalPlaces ?? DEFAULT_DECIMAL_PLACES;
    totals.set(currency._id, {currency, decimals, minor: toMinor(amount, decimals)});
}

/** The currency an aggregate line names, or undefined when it names none. */
export function currencyOfLine(line: AggregateMoneyLine): CurrencySimple | undefined {
    if (line.currencyId == null) return undefined;
    return {
        _id: String(line.currencyId),
        name: line.currencyName ?? "",
        symbol: line.currencySymbol ?? "",
        abbreviation: line.currencyAbbreviation ?? "",
        ...(line.currencyDecimalPlaces != null ? {decimalPlaces: line.currencyDecimalPlaces} : {}),
    };
}

/** Adds aggregate lines (Decimal128 sums) to their currencies' totals. */
export function addMoneyLines(totals: MoneyTotals, lines: readonly AggregateMoneyLine[] | undefined): void {
    for (const line of lines ?? []) {
        const currency = currencyOfLine(line);
        if (currency) addMoney(totals, currency, line.value == null ? 0 : String(line.value));
    }
}

/** Adds statistics rows (already rounded at their currency) to their currencies' totals. */
export function addMoneyRows(totals: MoneyTotals, rows: readonly EdificeMoneyByCurrency[] | undefined): void {
    for (const row of rows ?? []) {
        if (row.currency?._id != null) addMoney(totals, row.currency, row.value);
    }
}

/** Adds every total of `from` into `into`, currency by currency. */
export function addMoneyTotals(into: MoneyTotals, from: MoneyTotals): void {
    for (const [id, entry] of from) {
        const total = into.get(id);
        if (total) total.minor += entry.minor;
        else into.set(id, {...entry});
    }
}

/** The totals as statistics rows (`{currency, value}`). */
export function moneyRowsOf(totals: MoneyTotals): EdificeMoneyByCurrency[] {
    return [...totals.values()].map(({currency, decimals, minor}) => ({currency, value: minorToNumber(minor, decimals)}));
}

/** Statistics rows of several sources summed per currency. */
export function sumMoneyRows(rows: readonly EdificeMoneyByCurrency[]): EdificeMoneyByCurrency[] {
    const totals: MoneyTotals = new Map();
    addMoneyRows(totals, rows);
    return moneyRowsOf(totals);
}

/** The totals as dashboard rows (`{currencyId, currencyName, currencySymbol, currencyDecimalPlaces, value}`). */
export function revenueRowsOf(totals: MoneyTotals): RevenueByCurrency[] {
    return [...totals.values()].map(({currency, decimals, minor}) => ({
        currencyId: currency._id,
        currencyName: currency.name,
        currencySymbol: currency.symbol,
        currencyDecimalPlaces: decimals,
        value: minorToNumber(minor, decimals),
    }));
}
