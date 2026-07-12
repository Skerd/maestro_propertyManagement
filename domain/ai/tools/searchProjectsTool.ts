/**
 * `search_projects` — AI-assistant tool for real-estate developments (projects)
 * with a live unit rollup.
 *
 * Answers "what projects do we have?", "how many units are left in Seaside
 * Towers?", "which project has the most available units?". Lists Project records
 * and, for each, a count of its units broken down by status (available, reserved,
 * sold, …) computed from the real units. Hard-scoped to the calling human's
 * company; soft-deleted projects and units are excluded. Registered into the core
 * tool registry at startup; the brain (core) never imports this module directly.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, the
 * `search` term regex-escaped, and both the project query and the unit
 * aggregation carry `company: ObjectId(ctx.companyId)`. The model cannot widen
 * scope or roll up another company's units.
 *
 * @module searchProjectsTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;
/** Descriptions can be long; cap what we hand the model per project. */
const MAX_DESCRIPTION_CHARS = 300;

/** Escape a user/model-supplied string for safe use inside a RegExp. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SearchProjectsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the project name."},
        limit: {
            type: "integer",
            description: `Maximum number of projects to return (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

/** Trim a description to the model-facing cap, null-safe. */
function shortDescription(description: unknown): string | null {
    if (typeof description !== "string" || !description.trim()) return null;
    const text = description.trim();
    return text.length > MAX_DESCRIPTION_CHARS ? text.slice(0, MAX_DESCRIPTION_CHARS) + "…" : text;
}

/**
 * Roll up unit counts by status for the given projects, in one aggregation.
 * Returns a map: projectId -> {total, byStatus}. The soft-delete filter is added
 * manually because `aggregate` bypasses the query-level plugin.
 */
async function rollUpUnits(
    projectIds: ObjectId[],
    companyId: ObjectId,
    ctx: AssistantToolContext
): Promise<Map<string, {total: number; byStatus: Record<string, number>}>> {
    const summary = new Map<string, {total: number; byStatus: Record<string, number>}>();
    if (projectIds.length === 0) return summary;

    const rows: any[] = await unitService.aggregate(
        [
            {$match: {company: companyId, project: {$in: projectIds}, deletedAt: null}},
            {$group: {_id: {project: "$project", status: "$status"}, count: {$sum: 1}}}
        ],
        {logger: ctx.logger}
    );

    for (const row of rows) {
        const projectId = row._id?.project?.toString();
        if (!projectId) continue;
        const status = row._id?.status ?? "unknown";
        const count = row.count ?? 0;

        const entry = summary.get(projectId) ?? {total: 0, byStatus: {}};
        entry.total += count;
        entry.byStatus[status] = (entry.byStatus[status] ?? 0) + count;
        summary.set(projectId, entry);
    }

    return summary;
}

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchProjectsArgs.parse(rawArgs ?? {});

    const companyId = new ObjectId(ctx.companyId);

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: companyId};
    if (args.search != null) {
        query.name = {$regex: escapeRegex(args.search), $options: "i"};
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const projects = await projectService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        undefined,
        "name description saleCommissionRatePercent reservationCommissionRatePercent",
        {name: 1},
        limit
    );

    const projectIds = projects.map((p: any) => p._id).filter(Boolean);
    const unitSummary = await rollUpUnits(projectIds, companyId, ctx);

    const results = projects.map((p: any) => {
        const id = p._id?.toString();
        const units = (id && unitSummary.get(id)) || {total: 0, byStatus: {}};
        return {
            id,
            name: p.name ?? null,
            description: shortDescription(p.description),
            saleCommissionRatePercent: p.saleCommissionRatePercent ?? null,
            reservationCommissionRatePercent: p.reservationCommissionRatePercent ?? null,
            units: {total: units.total, byStatus: units.byStatus}
        };
    });

    return {count: results.length, capped: results.length >= limit, results};
}

export const searchProjectsTool: AssistantTool = {
    name: "search_projects",
    description:
        "List the company's real-estate projects (developments), optionally filtered " +
        "by name. For each project it returns a live unit rollup: the total number of " +
        "units and a breakdown by status (e.g. available, reserved, sold). Use this " +
        "for questions about projects/developments or how many units remain in a " +
        "project. To then list the actual units, use search_properties.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerProjectsAssistantTools(): void {
    registerAssistantTool(searchProjectsTool);
}
