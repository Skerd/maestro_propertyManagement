/**
 * Shared formatting and unit-location snapshot helpers for property-management
 * transactional emails (money amounts in recipient locale).
 */

import {Decimal128} from "mongodb";
import type {UnitLocationForEmail} from "../../kafka/types";

/** Unit fields required to build listing + location rows for client emails. */
export const UNIT_EMAIL_SELECT = "unitNumber name price floor edifice project";

/** Nested populate so `unitLocationForEmail` can read names, not ObjectIds. */
export const UNIT_EMAIL_POPULATE = [
    {path: "priceCurrency", select: "symbol"},
    {path: "floor", select: "name levelNumber"},
    {path: "edifice", select: "name"},
    {path: "project", select: "name"},
];

function populatedName(ref: unknown): string | undefined {
    if (ref == null || typeof ref !== "object" || !("name" in ref)) {
        return undefined;
    }
    const name = (ref as {name?: unknown}).name;
    return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

function floorNameForEmail(floor: unknown): string | undefined {
    const named = populatedName(floor);
    if (named) {
        return named;
    }
    if (floor != null && typeof floor === "object" && "levelNumber" in floor) {
        const n = (floor as {levelNumber?: unknown}).levelNumber;
        if (typeof n === "number" && Number.isFinite(n)) {
            return String(n);
        }
    }
    return undefined;
}

/** Reads populated unit refs; omits a field when the ref was not populated (ObjectId or missing name). */
export function unitLocationForEmail(
    unit:
        | {
              floor?: unknown;
              edifice?: unknown;
              project?: unknown;
          }
        | null
        | undefined
): UnitLocationForEmail {
    return {
        projectName: populatedName(unit?.project),
        edificeName: populatedName(unit?.edifice),
        floorName: floorNameForEmail(unit?.floor),
    };
}

export function formatMoneyAmountForEmail(rawNumeric: string, languageCode: string): string {
    const n = parseFloat(rawNumeric);
    if (!Number.isFinite(n)) {
        return rawNumeric;
    }
    try {
        return new Intl.NumberFormat(languageCode, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        return rawNumeric;
    }
}

export function formatReservationDepositForEmailDisplay(
    depositAmount: Decimal128 | undefined,
    currencySymbol: string | undefined,
    languageCode: string
): string | undefined {
    if (!depositAmount) {
        return undefined;
    }
    const n = parseFloat(depositAmount.toString());
    if (!Number.isFinite(n) || n <= 0) {
        return undefined;
    }
    const amt = formatMoneyAmountForEmail(String(n), languageCode);
    return currencySymbol ? `${amt} ${currencySymbol}` : amt;
}
