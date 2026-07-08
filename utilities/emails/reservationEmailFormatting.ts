/**
 * Shared formatting for reservation transactional emails (money amounts in recipient locale).
 */

import {Decimal128} from "mongodb";

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
