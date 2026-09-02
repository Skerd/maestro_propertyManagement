export const MAX_RENT_SCHEDULE_MONTHS = 600;

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
        if (dues.length > MAX_RENT_SCHEDULE_MONTHS) break;
    }

    return dues;
}

export function rentScheduleExceedsCap(startDate: Date, endDate: Date): boolean {
    const start = utcDateOnly(startDate);
    const end = utcDateOnly(endDate);
    if (start.getTime() > end.getTime()) return false;

    const dayOfMonth = start.getUTCDate();
    let count = 0;
    let year = start.getUTCFullYear();
    let month = start.getUTCMonth();

    while (true) {
        const due = utcClampedDay(year, month, dayOfMonth);
        if (due.getTime() > end.getTime()) return false;
        count += 1;
        if (count > MAX_RENT_SCHEDULE_MONTHS) return true;
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
    }
}

export function utcDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function dueDateKey(d: Date): string {
    const utc = utcDateOnly(d);
    const y = utc.getUTCFullYear();
    const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
    const day = String(utc.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function utcClampedDay(year: number, month: number, day: number): Date {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}
