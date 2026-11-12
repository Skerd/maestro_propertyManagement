/**
 * Calendar-day checks for reservation expiry and installment / rent due days, against the company's "today"
 * (GLB-09, D91) from core `companyTodayOf`, the same day the expiry and reminder crons use. The day checked is a
 * local `YYYY-MM-DD` string (D115).
 */
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {
    RESERVATION_EXPIRING_SOON_DAYS,
    type ReservationWhen,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.constants";

const DAY_MS = 86400000;

/** Whole calendar days from `today` to the stored calendar `day` (both `YYYY-MM-DD`): 0 = it is today, negative = it is over. */
export function calendarDaysUntil(day: string, today: string): number {
    // Both parse as UTC midnight, so the difference is whole days with no DST hour.
    return Math.round((Date.parse(day) - Date.parse(today)) / DAY_MS);
}

/** True once the stored calendar `day` is before `today`. Days compare as text. */
export function isCalendarDayOver(day: string, today: string): boolean {
    return day < today;
}

/** The list's "When" quick filter as a condition on the stored expiration day; days compare as text. */
export function reservationWhenCondition(when: ReservationWhen, today: string): Record<string, unknown> {
    if (when === "expired") return {expirationDate: {$lt: today}};
    return {expirationDate: {$gte: today, $lte: addLocalDays(today, RESERVATION_EXPIRING_SOON_DAYS)}};
}
