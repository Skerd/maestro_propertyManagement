import {ObjectId} from "mongodb";
import type {MarketingProjectHierarchy} from "./marketingHierarchy.util";

/**
 * "Show price on request" scoping for PUBLIC surfaces (marketing API, public AI chat).
 * Pure helpers — the DB-backed scope loader lives in `priceOnRequestScope.util.ts`.
 *
 * The flag lives on project, edifice, floor and unit and cascades down with OR semantics:
 * a unit's price is hidden when the unit, its floor, its edifice or its project is flagged.
 * A child can never re-enable a price hidden by a parent.
 *
 * The scope is expanded down to floor ids, since `unit.floor` is the only required parent
 * ref on a unit — the denormalized `unit.edifice` / `unit.project` may be missing on old rows.
 */
export type PriceOnRequestScope = {
    /** Edifices flagged directly or through their project. */
    edificeIds: Set<string>;
    /** Floors flagged directly or through their edifice / project. */
    floorIds: Set<string>;
};

/** Marker set on redacted records so mappers can tell "hidden" apart from "no price set". */
export const PRICE_ON_REQUEST_MARKER = "priceOnRequest";

// Areas (gross/net/shared/veranda, edifice total/green) are intentionally never redacted:
// the price can sit above or below any area-based estimate, so area alone doesn't leak it.
const UNIT_PRICE_FIELDS = ["price", "priceHistory", "priceCurrency"] as const;
const EDIFICE_PRICE_FIELDS = ["pricePerMeterSquared", "verandaPricePerMeterSquared", "saleCurrency"] as const;

/** String id of a ref that may be populated (`{_id}`), an ObjectId or a string. */
function refId(ref: unknown): string | undefined {
    if (ref == null) return undefined;
    const id = (ref as {_id?: unknown})._id ?? ref;
    const str = String(id);
    return str || undefined;
}

/** Builds a scope from already-expanded id lists (see `loadPriceOnRequestScope`). */
export function buildPriceOnRequestScope(edificeIds: unknown[], floorIds: unknown[]): PriceOnRequestScope {
    const toSet = (ids: unknown[]) =>
        new Set(ids.map(refId).filter((id): id is string => id != null));
    return {edificeIds: toSet(edificeIds), floorIds: toSet(floorIds)};
}

export function isUnitPriceOnRequest(unit: any, scope: PriceOnRequestScope): boolean {
    if (unit?.showPriceOnRequest === true) return true;
    const floorId = refId(unit?.floor);
    return floorId != null && scope.floorIds.has(floorId);
}

export function isEdificePriceOnRequest(edifice: any, scope: PriceOnRequestScope): boolean {
    if (edifice?.showPriceOnRequest === true) return true;
    const edificeId = refId(edifice);
    return edificeId != null && scope.edificeIds.has(edificeId);
}

/**
 * Shadows a field with an own property instead of assigning it: hierarchy records are
 * Mongoose documents whose schema setters (e.g. `price` → Decimal128) throw on undefined,
 * and a plain assignment would also mark the document modified. Works on plain objects too.
 */
function shadow(record: object, key: string, value: unknown): void {
    Object.defineProperty(record, key, {value, writable: true, configurable: true, enumerable: true});
}

export function redactUnitPrice(unit: object): void {
    for (const field of UNIT_PRICE_FIELDS) shadow(unit, field, undefined);
    shadow(unit, PRICE_ON_REQUEST_MARKER, true);
}

export function redactEdificePrice(edifice: object): void {
    for (const field of EDIFICE_PRICE_FIELDS) shadow(edifice, field, undefined);
    shadow(edifice, PRICE_ON_REQUEST_MARKER, true);
}

/** True when a record was redacted by this module. */
export function isPriceOnRequestRedacted(record: unknown): boolean {
    return !!record && (record as Record<string, unknown>)[PRICE_ON_REQUEST_MARKER] === true;
}

/** Redacts a unit in place when it is on request; returns whether it was. */
export function applyUnitPriceOnRequest(unit: any, scope: PriceOnRequestScope): boolean {
    if (!unit || !isUnitPriceOnRequest(unit, scope)) return false;
    redactUnitPrice(unit);
    return true;
}

/** Redacts every on-request unit and edifice of a loaded marketing hierarchy, in place. */
export function applyPriceOnRequest(hierarchy: MarketingProjectHierarchy, scope: PriceOnRequestScope): void {
    for (const edifice of hierarchy.edifices) {
        if (isEdificePriceOnRequest(edifice, scope)) redactEdificePrice(edifice);
    }
    for (const unit of hierarchy.units) {
        applyUnitPriceOnRequest(unit, scope);
    }
}

function scopeFloorObjectIds(scope: PriceOnRequestScope): ObjectId[] {
    return [...scope.floorIds].map((id) => new ObjectId(id));
}

/**
 * Mongo query clause matching only units whose price may be shown publicly.
 * Wrapped in `$and` so it can be spread into a query that already filters on `floor`.
 */
export function priceVisibleUnitMatch(scope: PriceOnRequestScope): Record<string, unknown> {
    const clauses: Record<string, unknown>[] = [{showPriceOnRequest: {$ne: true}}];
    if (scope.floorIds.size > 0) clauses.push({floor: {$nin: scopeFloorObjectIds(scope)}});
    return {$and: clauses};
}

/** Aggregation expression form of {@link priceVisibleUnitMatch}, for `$cond` inside `$group`. */
export function priceVisibleUnitExpr(scope: PriceOnRequestScope): Record<string, unknown> {
    const clauses: Record<string, unknown>[] = [{$ne: ["$showPriceOnRequest", true]}];
    if (scope.floorIds.size > 0) clauses.push({$not: [{$in: ["$floor", scopeFloorObjectIds(scope)]}]});
    return {$and: clauses};
}
