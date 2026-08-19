/**
 * Resolves the business keys the exported operations seeds carry.
 *
 * Anything pointing outside the property-management graph is exported as a business
 * key rather than an ObjectId, because a fresh init re-mints those documents:
 * `{$user}` → `User.username`, `{$currency}` → `Currency.abbreviation`.
 * Everything inside the graph keeps its original id and needs no lookup.
 */

import {Decimal128, ObjectId} from "mongodb";
import User from "@coreModule/database/schemas/user/user";
import Currency from "@coreModule/database/schemas/currency/currency";
import type {CurrencyRef, UserRef} from "./types";

export type OperationsRefs = {
    userByUsername: Map<string, ObjectId>;
    currencyByCode: Map<string, ObjectId>;
};

export async function loadOperationsRefs(): Promise<OperationsRefs> {
    const [users, currencies] = await Promise.all([
        User.find({}).select("_id username").lean(),
        Currency.find({}).select("_id abbreviation").lean(),
    ]);

    return {
        userByUsername: new Map<string, ObjectId>(
            (users as any[]).map((u) => [String(u.username), u._id as ObjectId]),
        ),
        currencyByCode: new Map<string, ObjectId>(
            (currencies as any[]).map((c) => [String(c.abbreviation), c._id as ObjectId]),
        ),
    };
}

export function resolveUser(refs: OperationsRefs, ref: UserRef | undefined): ObjectId | undefined {
    if (!ref) return undefined;
    return refs.userByUsername.get(ref.$user);
}

export function resolveCurrency(refs: OperationsRefs, ref: CurrencyRef | undefined): ObjectId | undefined {
    if (!ref) return undefined;
    return refs.currencyByCode.get(ref.$currency);
}

/** `{field: new Date(iso)}` when the export carried a date, `{}` when it carried null. */
export function optDate<K extends string>(key: K, iso: string | null | undefined): {[P in K]?: Date} {
    return (iso ? {[key]: new Date(iso)} : {}) as {[P in K]?: Date};
}

/** `{field: Decimal128}` when the export carried an amount, `{}` when it carried null. */
export function optDecimal<K extends string>(
    key: K,
    value: string | null | undefined,
): {[P in K]?: Decimal128} {
    return (value != null ? {[key]: Decimal128.fromString(value)} : {}) as {[P in K]?: Decimal128};
}

/** `{field: value}` when defined, `{}` otherwise — keeps optional refs out of the payload. */
export function opt<K extends string, V>(key: K, value: V | undefined | null): {[P in K]?: V} {
    return (value != null ? {[key]: value} : {}) as {[P in K]?: V};
}
