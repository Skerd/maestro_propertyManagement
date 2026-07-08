import {ObjectId} from "mongodb";
import {unitService} from "../unit/unit.service";
import {floorService} from "../floor/floor.service";
import {edificeService} from "../edifice/edifice.service";

export const UNIT_COST_SOFT_DELETE_MATCH = {
    $or: [{deletedAt: {$exists: false}}, {deletedAt: null}],
};

export type UnitCostHierarchyIdSets = {
    floorIds: ObjectId[];
    edificeIds: ObjectId[];
    projectIds: ObjectId[];
};

/**
 * ObjectId refs may be raw ObjectIds, strings, or populated subdocuments — never use `.toString()` on unknown refs.
 */
export function idStringFromRef(ref: unknown): string | undefined {
    if (ref == null) return undefined;
    if (typeof ref === "string" && ObjectId.isValid(ref)) return ref;
    if (ref instanceof ObjectId) return ref.toString();
    if (typeof ref === "object" && "_id" in (ref as object)) {
        const id = (ref as {_id: unknown})._id;
        if (id instanceof ObjectId) return id.toString();
        if (typeof id === "string" && ObjectId.isValid(id)) return id;
    }
    return undefined;
}

export function objectIdFromRef(ref: unknown): ObjectId | undefined {
    const s = idStringFromRef(ref);
    return s != null ? new ObjectId(s) : undefined;
}

/**
 * Resolve distinct floor / edifice / project ids for a batch of units (for scope roll-up and filters).
 */
export async function resolveHierarchySetsFromUnitIds(
    unitIds: ObjectId[],
    opts: {logger?: any; languageCode?: string},
): Promise<UnitCostHierarchyIdSets> {
    if (unitIds.length === 0) {
        return {floorIds: [], edificeIds: [], projectIds: []};
    }
    const units = await unitService.find({_id: {$in: unitIds}}, opts, "floor");
    const floorIdsRaw = [...new Set(units.map((u: any) => idStringFromRef(u.floor)).filter(Boolean))] as string[];
    const floorIds = floorIdsRaw.map((id) => new ObjectId(id));
    if (floorIds.length === 0) {
        return {floorIds: [], edificeIds: [], projectIds: []};
    }
    const floors = await floorService.find({_id: {$in: floorIds}}, opts, "edifice");
    const edificeIdsRaw = [...new Set(floors.map((f: any) => idStringFromRef(f.edifice)).filter(Boolean))] as string[];
    const edificeIds = edificeIdsRaw.map((id) => new ObjectId(id));
    if (edificeIds.length === 0) {
        return {floorIds, edificeIds: [], projectIds: []};
    }
    const edifices = await edificeService.find({_id: {$in: edificeIds}}, opts, "project");
    const projectIdsRaw = [...new Set(edifices.map((e: any) => idStringFromRef(e.project)).filter(Boolean))] as string[];
    const projectIds = projectIdsRaw.map((id) => new ObjectId(id));
    return {floorIds, edificeIds, projectIds};
}

const unitUnsetCond = {$or: [{unit: {$exists: false}}, {unit: null}]};
const floorUnsetCond = {$or: [{floor: {$exists: false}}, {floor: null}]};
const edificeUnsetCond = {$or: [{edifice: {$exists: false}}, {edifice: null}]};

/**
 * $match clauses: a unit cost is visible in a unit’s context if it is assigned to that unit, or (with null/absent
 * narrower scopes) to that unit’s floor, edifice, or project.
 */
export function buildUnitCostVisibilityOrClause(
    unitIds: ObjectId[],
    sets: UnitCostHierarchyIdSets,
): Record<string, unknown>[] {
    const ors: Record<string, unknown>[] = [{unit: {$in: unitIds}}];
    if (sets.floorIds.length > 0) {
        ors.push({$and: [unitUnsetCond, {floor: {$in: sets.floorIds}}]});
    }
    if (sets.edificeIds.length > 0) {
        ors.push({$and: [unitUnsetCond, floorUnsetCond, {edifice: {$in: sets.edificeIds}}]});
    }
    if (sets.projectIds.length > 0) {
        ors.push({$and: [unitUnsetCond, floorUnsetCond, edificeUnsetCond, {project: {$in: sets.projectIds}}]});
    }
    return ors;
}

/** Dashboard / company roll-up: same visibility rule, merged with `company` + status filters. */
export function buildUnitCostRollupMatch(
    companyId: ObjectId,
    unitIds: ObjectId[],
    sets: UnitCostHierarchyIdSets,
    extraMatch: Record<string, unknown>,
): Record<string, unknown> {
    return {
        company: companyId,
        ...extraMatch,
        $and: [
            UNIT_COST_SOFT_DELETE_MATCH,
            {$or: buildUnitCostVisibilityOrClause(unitIds, sets)},
        ],
    };
}

/**
 * Fragments for costs that apply to floor/edifice/project only (`unit` unset). Used for per-unit allocation pipelines.
 * Returns `null` when there is no hierarchy to inherit from (no inherited costs can match).
 */
export function inheritedOnlyUnitCostMatchFragments(
    sets: UnitCostHierarchyIdSets,
): {$and: [typeof unitUnsetCond, {$or: Record<string, unknown>[]}]} | null {
    const inheritedOrs: Record<string, unknown>[] = [];
    if (sets.floorIds.length > 0) {
        inheritedOrs.push({
            $and: [{floor: {$exists: true, $ne: null}}, {floor: {$in: sets.floorIds}}],
        });
    }
    if (sets.edificeIds.length > 0) {
        inheritedOrs.push({
            $and: [floorUnsetCond, {edifice: {$exists: true, $ne: null}}, {edifice: {$in: sets.edificeIds}}],
        });
    }
    if (sets.projectIds.length > 0) {
        inheritedOrs.push({
            $and: [floorUnsetCond, edificeUnsetCond, {project: {$in: sets.projectIds}}],
        });
    }
    if (inheritedOrs.length === 0) {
        return null;
    }
    return {$and: [unitUnsetCond, {$or: inheritedOrs}]};
}
