/**
 * Build monthly rent due dates from lease start through end (inclusive of start day-of-month).
 * Day-of-month is clamped when the target month is shorter (e.g. Jan 31 → Feb 28).
 */
export function buildMonthlyRentDueDates(startDate: Date, endDate: Date): Date[] {
    const start = utcDateOnly(startDate);
    const end = utcDateOnly(endDate);
    if (start.getTime() > end.getTime()) return [];

    const dayOfMonth = start.getUTCDate();
    const dues: Date[] = [];
    let year = start.getUTCFullYear();
    let month = start.getUTCMonth();

    while (true) {
        const due = utcClampedDay(year, month, dayOfMonth);
        if (due.getTime() > end.getTime()) break;
        dues.push(due);
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
        // Safety: avoid runaway loops on bad input
        if (dues.length > 600) break;
    }

    return dues;
}

function utcDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcClampedDay(year: number, month: number, day: number): Date {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}
