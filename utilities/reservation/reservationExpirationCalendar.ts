/**
 * Calendar-day checks for reservation expiry and installment / rent due days, against the company's "today"
 * (GLB-09, D91), the same day the expiry and reminder crons use. The day checked is a local `YYYY-MM-DD` string (D115).
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

/** Whole calendar days from `today` to the stored calendar `day` (both `YYYY-MM-DD`): 0 = it is today, negative = it is over. */
export function calendarDaysUntil(day: string, today: string): number {
    // Both parse as UTC midnight, so the difference is whole days with no DST hour.
    return Math.round((Date.parse(day) - Date.parse(today)) / DAY_MS);
}

/** True once the stored calendar `day` is before `today`. Days compare as text. */
export function isCalendarDayOver(day: string, today: string): boolean {
    return day < today;
}
