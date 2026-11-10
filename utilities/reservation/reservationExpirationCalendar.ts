/**
 * Calendar-day checks for reservation expiry and installment / rent due days, against the company's "today"
 * (GLB-09, D91), the same day the expiry and reminder crons use. The day checked is a calendar value stored at
 * midnight UTC, so its date is read in UTC.
 */
import type {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {companyTimeZoneOf} from "@coreModule/utilities/time/companyTimeZone";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";

const DAY_MS = 86400000;

/** The company's calendar day (`YYYY-MM-DD`) at `now`, in its timezone. */
export async function companyToday(companyId: ObjectId | string, opts: {session?: ClientSession | null; now?: Date} = {}): Promise<string> {
    return localDateOf(opts.now ?? new Date(), await companyTimeZoneOf(companyId, {session: opts.session}));
}

/** Whole calendar days from `today` to the stored calendar `day`: 0 = it is today, negative = it is over. */
export function calendarDaysUntil(day: Date, today: string): number {
    return Math.round((Date.parse(localDateOf(day, "UTC")) - Date.parse(today)) / DAY_MS);
}

/** True once the stored calendar `day` is before `today`. */
export function isCalendarDayOver(day: Date, today: string): boolean {
    return calendarDaysUntil(day, today) < 0;
}
