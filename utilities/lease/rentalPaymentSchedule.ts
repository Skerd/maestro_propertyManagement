export const MAX_RENT_SCHEDULE_MONTHS = 600;

type Ymd = {year: number; month: number; day: number};

/** A local `YYYY-MM-DD` day as numbers (month 0-based). The lease days are calendar days (GLB-09), never instants. */
function parseDay(day: string): Ymd {
    const [year, month, date] = day.slice(0, 10).split("-").map(Number);
    return {year, month: month - 1, day: date};
}

/** `day` in month `month` of `year`, clamped to the month's last day (Jan 31 → Feb 28), as `YYYY-MM-DD`. */
function clampedDay(year: number, month: number, day: number): string {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/**
 * Monthly rent due days from the lease start through its end, on the start's day of the month.
 * Day-of-month is clamped when the target month is shorter (e.g. Jan 31 → Feb 28). Days compare as text.
 */
export function buildMonthlyRentDueDates(startDate: string, endDate: string): string[] {
    if (startDate > endDate) return [];
    const start = parseDay(startDate);
    const dues: string[] = [];
    let {year, month} = start;

    while (true) {
        const due = clampedDay(year, month, start.day);
        if (due > endDate) break;
        dues.push(due);
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
        if (dues.length > MAX_RENT_SCHEDULE_MONTHS) break;
    }

    return dues;
}

export function rentScheduleExceedsCap(startDate: string, endDate: string): boolean {
    return buildMonthlyRentDueDates(startDate, endDate).length > MAX_RENT_SCHEDULE_MONTHS;
}
