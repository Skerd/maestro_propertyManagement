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

/**
 * Localized discount percentage with the amount it takes off the listed price, e.g. "5% (6,000 EUR)".
 * Undefined when the discount is missing or zero; the amount is omitted when the price is unknown.
 */
export function formatDiscountForEmail(
    rawPercent: {toString(): string} | number | string | null | undefined,
    listedPrice: {toString(): string} | number | string | null | undefined,
    currencySymbol: string | undefined,
    languageCode: string
): string | undefined {
    if (rawPercent == null) return undefined;
    const pct = parseFloat(String(rawPercent));
    if (!Number.isFinite(pct) || pct <= 0) return undefined;
    let pctDisplay: string;
    try {
        pctDisplay = new Intl.NumberFormat(languageCode, {style: "percent", maximumFractionDigits: 2}).format(pct / 100);
    } catch {
        pctDisplay = `${pct}%`;
    }
    const price = listedPrice == null ? NaN : parseFloat(String(listedPrice));
    if (!Number.isFinite(price)) return pctDisplay;
    const amt = formatMoneyAmountForEmail(String((price * pct) / 100), languageCode);
    return `${pctDisplay} (${currencySymbol ? `${amt} ${currencySymbol}` : amt})`;
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
