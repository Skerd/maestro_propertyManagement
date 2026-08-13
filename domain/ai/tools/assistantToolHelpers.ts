/**
 * propertyManagement-specific helpers for the AI-assistant tools.
 *
 * The generic mechanics — the `{total, returned, truncated, results}` envelope,
 * regex escaping, Decimal128 parsing, date/number ranges — live in core's
 * {@link module:assistantToolKit} and are re-exported here so every tool in this
 * folder can keep importing from one place. What stays local is the part that
 * only means something in this module: turning a human-typed project, building
 * or unit name into ids, always *within the company scope* so a model-supplied
 * name can never reach another tenant's records.
 *
 * This file deliberately exports NO `register*AssistantTools` function: the
 * bootstrap loader scans every `.ts` in this directory and only calls exports
 * matching that name, so a helper module is imported and then ignored.
 *
 * @module assistantToolHelpers
 */

import {ObjectId} from "mongodb";
import type {AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {
    MAX_RESULTS,
    companyScope,
    findOptions,
    regexClause
} from "@coreModule/domain/ai/tools/assistantToolKit";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import {edificeService} from "@propertyManagement/database/schemas/edifice/edifice.service";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";

// The generic toolkit, surfaced under this module's import path so tool files
// need only one import line.
export * from "@coreModule/domain/ai/tools/assistantToolKit";

/** Cap on how many unit ids a project/building scope filter may expand to. */
const MAX_SCOPE_UNITS = 5_000;

/**
 * Resolve a project name to ids within the company. Returns `[]` when nothing
 * matches — callers must then return an empty result rather than dropping the
 * filter, which would silently widen the answer.
 */
export async function resolveProjectIds(name: string, ctx: AssistantToolContext): Promise<ObjectId[]> {
    const projects = await projectService.find(
        {...companyScope(ctx), name: regexClause(name)},
        findOptions(ctx),
        undefined,
        "_id",
        undefined,
        MAX_RESULTS
    );
    return projects.map((p: any) => p._id).filter(Boolean);
}

/** Resolve a building (edifice) name to ids within the company. */
export async function resolveEdificeIds(name: string, ctx: AssistantToolContext): Promise<ObjectId[]> {
    const edifices = await edificeService.find(
        {...companyScope(ctx), name: regexClause(name)},
        findOptions(ctx),
        undefined,
        "_id",
        undefined,
        MAX_RESULTS
    );
    return edifices.map((e: any) => e._id).filter(Boolean);
}

/**
 * Resolve a unit number to its id within the company, so a model-supplied unit
 * number can never reach another company's records. `null` means no such unit.
 */
export async function resolveUnitId(unitNumber: string, ctx: AssistantToolContext): Promise<ObjectId | null> {
    const unit: any = await unitService.findOne(
        {...companyScope(ctx), unitNumber},
        findOptions(ctx),
        undefined,
        "_id"
    );
    return unit?._id ?? null;
}

/** Resolve unit ids belonging to a project name, within the company. */
export async function resolveUnitIdsForProject(name: string, ctx: AssistantToolContext): Promise<ObjectId[]> {
    const projectIds = await resolveProjectIds(name, ctx);
    if (projectIds.length === 0) return [];
    const units = await unitService.find(
        {...companyScope(ctx), project: {$in: projectIds}},
        findOptions(ctx),
        undefined,
        "_id",
        undefined,
        MAX_SCOPE_UNITS
    );
    return units.map((u: any) => u._id).filter(Boolean);
}

/** Resolve unit ids belonging to a building name, within the company. */
export async function resolveUnitIdsForEdifice(name: string, ctx: AssistantToolContext): Promise<ObjectId[]> {
    const edificeIds = await resolveEdificeIds(name, ctx);
    if (edificeIds.length === 0) return [];
    const units = await unitService.find(
        {...companyScope(ctx), edifice: {$in: edificeIds}},
        findOptions(ctx),
        undefined,
        "_id",
        undefined,
        MAX_SCOPE_UNITS
    );
    return units.map((u: any) => u._id).filter(Boolean);
}
