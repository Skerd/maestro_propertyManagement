/**
 * `search_buildings` — AI-assistant tool for buildings (edifices) with a live
 * unit rollup.
 *
 * Answers "what buildings are in the Seaside project?", "how many units are left
 * in Block A?", "which building has the most available units?". Lists Edifice
 * records and, for each, a count of its units broken down by status. Hard-scoped
 * to the calling human's company; soft-deleted buildings and units excluded.
 * Registered into the core tool registry at startup; the brain (core) never
 * imports this module directly.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, the
 * `search`/`projectName` terms regex-escaped, and every query (building find, the
 * project resolution, and the unit aggregation) carries `company:
 * ObjectId(ctx.companyId)`. Fields the schema marks SENSITIVE (investment value/
 * currency, constructors) are deliberately NOT selected or returned.
 *
 * @module searchBuildingsTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {edificeService} from "@propertyManagement/database/schemas/edifice/edifice.service";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;
/** Cap the number of facility strings handed to the model per building. */
const MAX_FACILITIES = 10;

/** Escape a user/model-supplied string for safe use inside a RegExp. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SearchBuildingsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the building name."},
        projectName: {type: "string", description: "Only buildings that belong to a project whose name matches this."},
        limit: {
            type: "integer",
            description: `Maximum number of buildings to return (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

/** Trim a string array to the model-facing cap, dropping empties. */
function shortFacilities(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    return list.filter(x => typeof x === "string" && x.trim()).slice(0, MAX_FACILITIES);
}

/**
 * Roll up unit counts by status for the given buildings, in one aggregation.
 * Returns a map: edificeId -> {total, byStatus}. The soft-delete filter is added
 * manually because `aggregate` bypasses the query-level plugin.
 */
async function rollUpUnits(
    edificeIds: ObjectId[],
    companyId: ObjectId,
    ctx: AssistantToolContext
): Promise<Map<string, {total: number; byStatus: Record<string, number>}>> {
    const summary = new Map<string, {total: number; byStatus: Record<string, number>}>();
    if (edificeIds.length === 0) return summary;

    const rows: any[] = await unitService.aggregate(
        [
            {$match: {company: companyId, edifice: {$in: edificeIds}, deletedAt: null}},
            {$group: {_id: {edifice: "$edifice", status: "$status"}, count: {$sum: 1}}}
        ],
        {logger: ctx.logger}
    );

    for (const row of rows) {
        const edificeId = row._id?.edifice?.toString();
        if (!edificeId) continue;
        const status = row._id?.status ?? "unknown";
        const count = row.count ?? 0;

        const entry = summary.get(edificeId) ?? {total: 0, byStatus: {}};
        entry.total += count;
        entry.byStatus[status] = (entry.byStatus[status] ?? 0) + count;
        summary.set(edificeId, entry);
    }

    return summary;
}

/** Resolve project ids whose name matches, within the company. */
async function resolveProjectIds(projectName: string, companyId: ObjectId, ctx: AssistantToolContext): Promise<ObjectId[]> {
    const projects = await projectService.find(
        {company: companyId, name: {$regex: escapeRegex(projectName), $options: "i"}},
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        undefined,
        "_id",
        undefined,
        MAX_RESULTS
    );
    return projects.map((p: any) => p._id).filter(Boolean);
}

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchBuildingsArgs.parse(rawArgs ?? {});

    const companyId = new ObjectId(ctx.companyId);

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: companyId};
    if (args.search != null) {
        query.name = {$regex: escapeRegex(args.search), $options: "i"};
    }
    if (args.projectName != null) {
        const projectIds = await resolveProjectIds(args.projectName, companyId, ctx);
        if (projectIds.length === 0) {
            return {count: 0, capped: false, results: [], note: `No project matching "${args.projectName}" in this company.`};
        }
        query.project = {$in: projectIds};
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    // NOTE: sensitive fields (investmentValue, investmentCurrency, constructors) are
    // intentionally excluded from the projection — the assistant must not surface them.
    const buildings = await edificeService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "address.city", select: "name"},
            {path: "address.country", select: "name"},
            {path: "project", select: "name"}
        ],
        "name address totalArea greenArea distanceFromCityCenter commercialFacilities neighborhoodFacilities project",
        {name: 1},
        limit
    );

    const edificeIds = buildings.map((b: any) => b._id).filter(Boolean);
    const unitSummary = await rollUpUnits(edificeIds, companyId, ctx);

    const results = buildings.map((b: any) => {
        const id = b._id?.toString();
        const units = (id && unitSummary.get(id)) || {total: 0, byStatus: {}};
        return {
            id,
            name: b.name ?? null,
            project: b.project?.name ?? null,
            address: {
                street: b.address?.street ?? null,
                city: b.address?.city?.name ?? null,
                country: b.address?.country?.name ?? null,
                postalCode: b.address?.postalCode ?? null
            },
            totalArea: b.totalArea ?? null,
            greenArea: b.greenArea ?? null,
            distanceFromCityCenterMeters: b.distanceFromCityCenter ?? null,
            commercialFacilities: shortFacilities(b.commercialFacilities),
            neighborhoodFacilities: shortFacilities(b.neighborhoodFacilities),
            units: {total: units.total, byStatus: units.byStatus}
        };
    });

    return {count: results.length, capped: results.length >= limit, results};
}

export const searchBuildingsTool: AssistantTool = {
    name: "search_buildings",
    description:
        "List the company's buildings (edifices), optionally filtered by building " +
        "name or by the project they belong to. For each building it returns the " +
        "address, areas, nearby facilities, and a live unit rollup (total units plus " +
        "a breakdown by status such as available/reserved/sold). Use this for " +
        "questions about buildings/blocks or how many units remain in a building. To " +
        "list the actual units, use search_properties.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerBuildingsAssistantTools(): void {
    registerAssistantTool(searchBuildingsTool);
}
