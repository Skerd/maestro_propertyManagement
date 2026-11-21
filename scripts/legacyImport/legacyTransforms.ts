/**
 * The pure rules of the legacy import (D171): what is skipped and why, how an old value becomes the value the current
 * schema stores, which amounts are money, and how an encrypted value written under the old instance's key is read.
 * No database access here, so every rule is unit-tested on its own.
 */
import crypto from "node:crypto";
import mongoose, {Schema} from "mongoose";
import {Decimal128} from "mongodb";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {isPlainObject} from "./idMap";

/** Collections left in the archive (user decision 1, 2026-11-18): machine telemetry of the old servers, and state the new system rebuilds. */
export const SKIPPED_COLLECTIONS: ReadonlyMap<string, string> = new Map([
    ["apiaccesses", "API request log of the old servers (telemetry)"],
    ["serviceuptimes", "uptime pings of the old servers (telemetry)"],
    ["cronexecutions", "cron run log of the old servers (telemetry)"],
    ["cronjobs", "cron schedules: the new system seeds its own per company"],
    ["cronlocks", "cron leader lock of the old servers"],
    ["usersessions", "login sessions: old sessions must not stay valid"],
    ["dashboardcaches", "dashboard cache (expires after an hour)"],
]);

/** The old servers' health time series; mongodump writes their buckets as `system.buckets.<name>`. */
const SERVER_TIME_SERIES = /^(system\.buckets\.)?server(Performance|Health)1[mhd]$/;

/** Why a collection is left in the archive, or undefined when it is imported. */
export function skippedReason(collection: string): string | undefined {
    if (SERVER_TIME_SERIES.test(collection)) return "server health/performance time series (telemetry)";
    return SKIPPED_COLLECTIONS.get(collection);
}

/** Retired features: the documents are kept in the report folder, not imported. */
export const RETIRED_COLLECTIONS: ReadonlyMap<string, string> = new Map([
    ["finances", "per-user wallets were retired (maestro f868339); the documents are saved in skipped/finances.ndjson"],
]);

/** Audit entries about these collections describe rows that are not imported (catalog, old per-company lists, sessions). */
export const AUDIT_SKIPPED_COLLECTIONS: ReadonlySet<string> = new Set([
    "rolepermissions", "countries", "states", "cities", "currencies", "usersessions", "cronjobs", "finances",
    "apiaccesses", "serviceuptimes", "cronexecutions", "cronlocks", "dashboardcaches",
]);

const LOCAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written `YYYY-MM-DD`. */
export function isLocalDay(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const match = LOCAL_DAY.exec(value);
    if (!match) return false;
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/**
 * The calendar day an old stored Date stands for. The old forms saved a day as midnight UTC, so such a value is its
 * UTC date (a zone west of UTC would shift it back a day). Any other value was a moment ("paid now"), and its day is
 * the one in the company's zone (GLB-09).
 */
export function legacyLocalDay(value: Date, timeZone: string): {day: string; hadTimeOfDay: boolean} {
    const isUtcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
    if (isUtcMidnight) return {day: value.toISOString().slice(0, 10), hadTimeOfDay: false};
    return {day: localDateOf(value, timeZone), hadTimeOfDay: true};
}

export interface Conversion {
    path: string;
    kind: "localDay" | "decimal";
    from: string;
    to: string;
    /** For a local day: the old value carried a time of day, so the company's zone decided the day. */
    hadTimeOfDay?: boolean;
}

function convertLeaf(instance: string | undefined, value: unknown, path: string, timeZone: string, conversions: Conversion[]): unknown {
    if (value instanceof Date && instance === "String") {
        const {day, hadTimeOfDay} = legacyLocalDay(value, timeZone);
        conversions.push({path, kind: "localDay", from: value.toISOString(), to: day, hadTimeOfDay});
        return day;
    }
    if (typeof value === "number" && instance === "Decimal128") {
        // A JS number's shortest printed form is the value it was written as, so this is exact.
        const decimal = Decimal128.fromString(String(value));
        conversions.push({path, kind: "decimal", from: String(value), to: decimal.toString()});
        return decimal;
    }
    return value;
}

/**
 * Rewrites, in place, the values whose stored type the current schema changed: a calendar day kept as a Date in the
 * old build is a `YYYY-MM-DD` String now (D36), and an amount kept as a Number is a Decimal128 (D35). Driven by the
 * current Mongoose schema itself, so every such field of every collection is covered, nested and in arrays.
 */
export function conformToSchema(schema: Schema, document: Record<string, unknown>, timeZone: string): Conversion[] {
    const conversions: Conversion[] = [];
    const walk = (current: Schema, object: Record<string, unknown>, prefix: string, reportPrefix: string): void => {
        for (const [key, value] of Object.entries(object)) {
            const path = prefix ? `${prefix}.${key}` : key;
            const reportPath = reportPrefix ? `${reportPrefix}.${key}` : key;
            const type = current.path(path);
            if (!type) {
                if (current.pathType(path) === "nested" && isPlainObject(value)) walk(current, value, path, reportPath);
                continue;
            }
            if (type instanceof mongoose.Schema.Types.DocumentArray) {
                if (Array.isArray(value)) {
                    for (const item of value) if (isPlainObject(item)) walk(type.schema, item, "", `${reportPath}[]`);
                }
            } else if (type instanceof mongoose.Schema.Types.Subdocument) {
                if (isPlainObject(value)) walk(type.schema, value, "", reportPath);
            } else if (type instanceof mongoose.Schema.Types.Array) {
                if (Array.isArray(value)) object[key] = value.map((item) => convertLeaf(type.caster?.instance, item, `${reportPath}[]`, timeZone, conversions));
            } else {
                object[key] = convertLeaf(type.instance, value, reportPath, timeZone, conversions);
            }
        }
    };
    walk(schema, document, "", "");
    return conversions;
}

/**
 * The Decimal128 money amounts of each imported collection and where each one's currency comes from (D35 table).
 * `currency` is a path in the same document (the nearest one for amounts inside an array item) or the sale a payment
 * plan belongs to, which carries the plan's currency by design.
 */
export interface MoneyField {
    amount: string;
    currency: string | {viaSale: true};
}

export const MONEY_FIELDS: Readonly<Record<string, readonly MoneyField[]>> = {
    units: [{amount: "price", currency: "priceCurrency"}, {amount: "priceHistory[].price", currency: "priceHistory[].currency"}],
    edifices: [{amount: "investmentValue", currency: "investmentCurrency"}],
    reservations: [{amount: "depositAmount", currency: "depositCurrency"}],
    sales: [
        {amount: "listedUnitPrice", currency: "listedUnitCurrency"},
        {amount: "finalPrice", currency: "saleCurrency"},
        {amount: "reservationConvertedAmount", currency: "saleCurrency"},
        {amount: "reservationDepositAmount", currency: "reservationDepositCurrency"},
    ],
    paymentplans: [
        {amount: "totalAmount", currency: {viaSale: true}},
        {amount: "downPayment", currency: {viaSale: true}},
        {amount: "remainingBalance", currency: {viaSale: true}},
        {amount: "installmentAmount", currency: {viaSale: true}},
        {amount: "installments[].amount", currency: {viaSale: true}},
        {amount: "installments[].principalAmount", currency: {viaSale: true}},
        {amount: "installments[].interestAmount", currency: {viaSale: true}},
        {amount: "installments[].paidAmount", currency: {viaSale: true}},
        {amount: "installments[].lateFeeAmount", currency: {viaSale: true}},
        {amount: "installments[].paymentReceipts[].amount", currency: {viaSale: true}},
    ],
    commissions: [{amount: "basisAmount", currency: "currency"}, {amount: "amount", currency: "currency"}, {amount: "splits[].amount", currency: "currency"}],
    unitcosts: [{amount: "budgetedAmount", currency: "currency"}, {amount: "expenditureItems[].pricePerUnit", currency: "currency"}],
    leads: [{amount: "budget", currency: "budgetCurrency"}],
    modificationrequests: [{amount: "engineerApproval.materialsPlan[].pricePerUnit", currency: "engineerApproval.materialsPlan[].currency"}],
};

/**
 * Every value at `amountPath` with the currency id beside it. Array steps (`[]`) fan out; a currency path that shares
 * the amount's array prefix is read from the same item, any other from the document.
 */
export function moneyValues(document: Record<string, unknown>, field: MoneyField, saleCurrencyOf?: (saleId: unknown) => unknown): Array<{amount: unknown; currency: unknown}> {
    const out: Array<{amount: unknown; currency: unknown}> = [];
    const amountSteps = field.amount.split(".");
    const currencySteps = typeof field.currency === "string" ? field.currency.split(".") : [];
    const documentCurrency = typeof field.currency === "string" ? readPath(document, currencySteps) : saleCurrencyOf?.(document.sale);

    const walk = (value: unknown, steps: string[], depth: number, itemCurrency: unknown): void => {
        if (value == null) return;
        if (steps.length === 0) {
            out.push({amount: value, currency: itemCurrency});
            return;
        }
        const [step, ...rest] = steps;
        const isArray = step.endsWith("[]");
        const key = isArray ? step.slice(0, -2) : step;
        if (!isPlainObject(value)) return;
        const next = value[key];
        if (!isArray) {
            walk(next, rest, depth + 1, itemCurrency);
            return;
        }
        if (!Array.isArray(next)) return;
        for (const item of next) {
            // The currency sits in the same array item when its path shares this array step.
            const sharesItem = typeof field.currency === "string" && currencySteps[depth] === step;
            const currency = sharesItem && isPlainObject(item) ? readPath(item, currencySteps.slice(depth + 1)) : itemCurrency;
            walk(item, rest, depth + 1, currency);
        }
    };
    walk(document, amountSteps, 0, documentCurrency);
    return out;
}

function readPath(value: unknown, steps: string[]): unknown {
    let current: unknown = value;
    for (const step of steps) {
        if (!isPlainObject(current)) return undefined;
        current = current[step.endsWith("[]") ? step.slice(0, -2) : step];
    }
    return current;
}

/** Fields whose stored value is encrypted with the instance's `ENCRYPTION_KEY` (core EncryptString). */
export const ENCRYPTED_FIELDS: Readonly<Record<string, readonly string[]>> = {
    messages: ["text", "forwardedText", "reactions[].emoji"],
    smtpservers: ["passwordEncrypted"],
};

const ENCRYPTED_PAYLOAD = /^[0-9a-f]{32}:[0-9a-f]+$/i;

/**
 * Decrypts a core `EncryptString` value under `key` (AES-256-CBC, key = SHA-256 of the secret, `ivhex:cipherhex`).
 * The core helper is bound to this instance's key; a value written by the old instance must be read with that
 * instance's key. Throws when the key is wrong or the value is not valid UTF-8 text.
 */
export function decryptWithKey(payload: string, key: string): string {
    if (!ENCRYPTED_PAYLOAD.test(payload)) throw new Error("not an encrypted value");
    const [ivHex, cipherHex] = payload.split(":");
    const decipher = crypto.createDecipheriv("aes-256-cbc", crypto.createHash("sha256").update(key).digest(), Buffer.from(ivHex, "hex"));
    const plain = Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]);
    const text = plain.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(plain)) throw new Error("decrypted bytes are not UTF-8 text");
    return text;
}

/** True when `value` looks like a core encrypted payload (plain legacy text is stored as-is and stays as-is). */
export function isEncryptedPayload(value: unknown): value is string {
    return typeof value === "string" && ENCRYPTED_PAYLOAD.test(value);
}
