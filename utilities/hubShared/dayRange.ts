/**
 * Date filters of the propertyManagement hubs. Due, sale, booking and lease days are local `YYYY-MM-DD` strings
 * (GLB-09, D115), which sort as text, so a range is two day strings and a check is a string comparison: no timezone
 * and no midnight-UTC instants.
 */

/** Inclusive bounds; an absent bound is open. */
export type DayRange = {from?: string; to?: string};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A filter bound as a local day (a time suffix is ignored); anything else is no bound. */
function dayBound(value?: string): string | undefined {
    const day = value?.trim().slice(0, 10);
    return day && DAY.test(day) ? day : undefined;
}

/** The hub's `from`/`to` filter fields as a {@link DayRange}. */
export function parseDayRange(from?: string, to?: string): DayRange {
    return {from: dayBound(from), to: dayBound(to)};
}

/** The first and last day of a `YYYY-MM` month. */
export function monthDayRange(month: string): {from: string; to: string} {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const prefix = `${year}-${String(monthNumber).padStart(2, "0")}`;
    return {from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, "0")}`};
}

/** True when `day` lies in `range` (both ends included). An empty range passes everything; a missing day passes none. */
export function inDayRange(day: string | undefined, range: DayRange): boolean {
    if (!range.from && !range.to) return true;
    if (!day) return false;
    if (range.from && day < range.from) return false;
    if (range.to && day > range.to) return false;
    return true;
}
