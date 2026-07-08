/**
 * UTC calendar helpers for reservation expiration (aligned with reminder cron).
 */

/** Whole UTC calendar days from today (start) to expiration day (start). 0 = today is expiration day. */
export function utcCalendarDaysUntilExpirationDay(expirationDate: Date, now: Date = new Date()): number {
    const e = new Date(expirationDate);
    const expStart = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
    const n = new Date(now);
    const todayStart = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    return Math.round((expStart - todayStart) / 86400000);
}

/** True after 23:59:59.999 UTC on the expiration calendar day. */
export function isPastExpirationUtcEndOfDay(expirationDate: Date, now: Date = new Date()): boolean {
    const e = new Date(expirationDate);
    const end = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999);
    return now.getTime() > end;
}
