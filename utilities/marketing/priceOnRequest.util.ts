import {ObjectId} from "mongodb";
import {
    PRICE_VISIBILITY_LEVELS,
    type EffectivePriceVisibility,
    type PriceVisibilityLevel,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/priceVisibility.constants";
import type {MarketingProjectHierarchy} from "./marketingHierarchy.util";

/**
 * Public price visibility ("price on request") for PUBLIC surfaces (marketing API, public AI chat).
 * Pure helpers — the DB-backed loaders live in `priceOnRequestScope.util.ts`.
 *
 * Project, edifice, floor and unit each carry `priceVisibility`: `inherit` | `hide` | `show`.
 * Walking project → edifice → floor → unit, the level closest to the record with an explicit
 * choice wins; when every level inherits, the price is shown. So a unit set to `show` shows its
 * price inside a hidden edifice, and a floor set to `hide` hides a whole floor of a shown project.
 *
 * The scope is resolved down to floor ids, since `unit.floor` is the only required parent ref
 * on a unit — the denormalized `unit.edifice` / `unit.project` may be missing on old rows.
 */
export type PriceDecision = "hide" | "show";

export type PriceOnRequestScope = {
    /** Decision per edifice from its own / its project's explicit choice. Absent = no decision (shown). */
    edificeDecisions: Map<string, PriceDecision>;
    /** Decision per floor from its own / edifice / project explicit choice. Absent = no decision (shown). */
    floorDecisions: Map<string, PriceDecision>;
};

/** Marker set on redacted records so mappers can tell "hidden" apart from "no price set". */
export const PRICE_ON_REQUEST_MARKER = "priceOnRequest";

// Areas (gross/net/shared/veranda, edifice total/green) are intentionally never redacted:
// the price can sit above or below any area-based estimate, so area alone doesn't leak it.
const UNIT_PRICE_FIELDS = ["price", "priceHistory", "priceCurrency"] as const;
const EDIFICE_PRICE_FIELDS = ["pricePerMeterSquared", "verandaPricePerMeterSquared", "saleCurrency"] as const;

/** String id of a ref that may be populated (`{_id}`), an ObjectId or a string. */
export function refId(ref: unknown): string | undefined {
    if (ref == null) return undefined;
    const id = (ref as {_id?: unknown})._id ?? ref;
    const str = String(id);
    return str || undefined;
}

/** A record's own explicit choice; `inherit`, missing or unknown values yield `undefined`. */
export function explicitPriceDecision(value: unknown): PriceDecision | undefined {
    return value === "hide" || value === "show" ? value : undefined;
}

/**
 * Resolves visibility from each level's own `priceVisibility` (nearest explicit choice wins).
 * Pass only the levels that exist for the record, e.g. `{project, edifice}` for an edifice.
 */
export function resolvePriceVisibility(
    chain: Partial<Record<PriceVisibilityLevel, unknown>>,
): EffectivePriceVisibility {
    let hidden = false;
    let source: EffectivePriceVisibility["source"] = "default";
    for (const level of PRICE_VISIBILITY_LEVELS) {
        const decision = explicitPriceDecision(chain[level]);
        if (decision) {
            hidden = decision === "hide";
            source = level;
        }
    }
    return {hidden, source, key: `${hidden ? "hidden" : "shown"}_${source}`};
}

// `_id` is optional to match Mongoose document typings; records without one are skipped.
type ScopeProject = {_id?: unknown; priceVisibility?: unknown};
type ScopeEdifice = {_id?: unknown; project?: unknown; priceVisibility?: unknown};
type ScopeFloor = {_id?: unknown; edifice?: unknown; priceVisibility?: unknown};

/**
 * Builds a scope from the records that carry a decision: explicitly set projects, edifices
 * with an explicit choice or a decided project, floors with an explicit choice or a decided edifice.
 */
export function buildPriceOnRequestScope(input: {
    projects: ScopeProject[];
    edifices: ScopeEdifice[];
    floors: ScopeFloor[];
}): PriceOnRequestScope {
    const projectDecisions = new Map<string, PriceDecision>();
    for (const project of input.projects) {
        const id = refId(project._id);
        const decision = explicitPriceDecision(project.priceVisibility);
        if (id && decision) projectDecisions.set(id, decision);
    }

    const edificeDecisions = new Map<string, PriceDecision>();
    for (const edifice of input.edifices) {
        const id = refId(edifice._id);
        const projectId = refId(edifice.project);
        const decision = explicitPriceDecision(edifice.priceVisibility)
            ?? (projectId ? projectDecisions.get(projectId) : undefined);
        if (id && decision) edificeDecisions.set(id, decision);
    }

    const floorDecisions = new Map<string, PriceDecision>();
    for (const floor of input.floors) {
        const id = refId(floor._id);
        const edificeId = refId(floor.edifice);
        const decision = explicitPriceDecision(floor.priceVisibility)
            ?? (edificeId ? edificeDecisions.get(edificeId) : undefined);
        if (id && decision) floorDecisions.set(id, decision);
    }

    return {edificeDecisions, floorDecisions};
}

export function isUnitPriceOnRequest(unit: any, scope: PriceOnRequestScope): boolean {
    const floorId = refId(unit?.floor);
    const decision = explicitPriceDecision(unit?.priceVisibility)
        ?? (floorId ? scope.floorDecisions.get(floorId) : undefined);
    return decision === "hide";
}

export function isEdificePriceOnRequest(edifice: any, scope: PriceOnRequestScope): boolean {
    const edificeId = refId(edifice);
    const decision = explicitPriceDecision(edifice?.priceVisibility)
        ?? (edificeId ? scope.edificeDecisions.get(edificeId) : undefined);
    return decision === "hide";
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

function hiddenFloorObjectIds(scope: PriceOnRequestScope): ObjectId[] {
    const ids: ObjectId[] = [];
    for (const [id, decision] of scope.floorDecisions) {
        if (decision === "hide") ids.push(new ObjectId(id));
    }
    return ids;
}

/**
 * Mongo query clause matching only units whose price may be shown publicly: the unit is
 * explicitly `show`, or it isn't explicitly `hide` and its floor doesn't resolve to hidden.
 * Wrapped in `$and` so it can be merged into a query that already uses `$or` / `floor`.
 */
export function priceVisibleUnitMatch(scope: PriceOnRequestScope): Record<string, unknown> {
    const hiddenFloors = hiddenFloorObjectIds(scope);
    const inherits: Record<string, unknown>[] = [{priceVisibility: {$ne: "hide"}}];
    if (hiddenFloors.length > 0) inherits.push({floor: {$nin: hiddenFloors}});
    return {$and: [{$or: [{priceVisibility: "show"}, {$and: inherits}]}]};
}

/** Aggregation expression form of {@link priceVisibleUnitMatch}, for `$cond` inside `$group`. */
export function priceVisibleUnitExpr(scope: PriceOnRequestScope): Record<string, unknown> {
    const hiddenFloors = hiddenFloorObjectIds(scope);
    const inherits: Record<string, unknown>[] = [{$ne: ["$priceVisibility", "hide"]}];
    if (hiddenFloors.length > 0) inherits.push({$not: [{$in: ["$floor", hiddenFloors]}]});
    return {$or: [{$eq: ["$priceVisibility", "show"]}, {$and: inherits}]};
}
