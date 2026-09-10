/**
 * `search_snags` + `search_inspections` — AI-assistant tools for unit quality:
 * defects raised against a unit, and the inspections that find them.
 *
 * Answers "how many open snags do we have?", "show critical defects in Block A",
 * "which snags are overdue?", "what did the last inspection of A-102 find?",
 * "which inspections need a follow-up?".
 *
 * NOTE ON SCOPE. A Snag has no project or edifice field of its own — it hangs
 * off a unit. So a project/building filter is resolved to unit ids first (inside
 * the company scope) and applied as `unit: {$in: [...]}`.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, free
 * text regex-escaped, and every query hard-scoped to `ctx.companyId`.
 *
 * @module snagsAndInspectionsTools
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {inspectionService} from "@propertyManagement/database/schemas/inspection/inspection.service";
import {InspectionStatus, InspectionType} from "@propertyManagement/database/schemas/inspection/inspection";
import {
    DEFAULT_RESULTS,
    companyScope,
    dateRange,
    emptyResult,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    resolveUnitId,
    resolveUnitIdsForEdifice,
    resolveUnitIdsForProject,
    shortText,
    userDisplayName
} from "./assistantToolHelpers";

const INSPECTION_STATUS_VALUES = Object.values(InspectionStatus) as string[];
const INSPECTION_TYPE_VALUES = Object.values(InspectionType) as string[];

async function unitClause(
    args: {projectName?: string; buildingName?: string; unitNumber?: string},
    ctx: AssistantToolContext
): Promise<{clause: unknown} | null> {
    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) return null;
        return {clause: unitId};
    }
    if (args.projectName != null) {
        const ids = await resolveUnitIdsForProject(args.projectName, ctx);
        if (ids.length === 0) return null;
        return {clause: {$in: ids}};
    }
    if (args.buildingName != null) {
        const ids = await resolveUnitIdsForEdifice(args.buildingName, ctx);
        if (ids.length === 0) return null;
        return {clause: {$in: ids}};
    }
    return {clause: undefined};
}

const locationParameters = {
    projectName: {type: "string", description: "Only records for units in the project whose name matches this."},
    buildingName: {type: "string", description: "Only records for units in the building (edifice/block) whose name matches this."},
    unitNumber: {type: "string", description: "Only records for this exact unit number (e.g. \"A-102\")."}
};

const locationArgs = {
    projectName: z.string().trim().min(1).optional(),
    buildingName: z.string().trim().min(1).optional(),
    unitNumber: z.string().trim().min(1).optional()
};

// ── search_inspections ───────────────────────────────────────────────────────

const SearchInspectionsArgs = z
    .object({
        ...locationArgs,
        status: z.enum(INSPECTION_STATUS_VALUES as [string, ...string[]]).optional(),
        type: z.enum(INSPECTION_TYPE_VALUES as [string, ...string[]]).optional(),
        inspectedFrom: z.coerce.date().optional(),
        inspectedTo: z.coerce.date().optional(),
        followUpRequired: z.coerce.boolean().optional(),
        limit: limitArg
    })
    .strip();

const inspectionParameters = {
    type: "object" as const,
    properties: {
        ...locationParameters,
        status: {
            type: "string",
            enum: INSPECTION_STATUS_VALUES,
            description: "Inspection status: scheduled, in_progress, completed, cancelled, or rescheduled."
        },
        type: {
            type: "string",
            enum: INSPECTION_TYPE_VALUES,
            description: "Inspection type: initial, follow_up, final, routine, complaint, pre_sale, or post_sale."
        },
        inspectedFrom: {type: "string", description: "ISO date; only inspections on or after this date."},
        inspectedTo: {type: "string", description: "ISO date; only inspections on or before this date."},
        followUpRequired: {type: "boolean", description: "true = only inspections that flagged a follow-up as required."},
        limit: limitParameter
    },
    required: [] as string[]
};

/** Count the findings recorded on an inspection, by severity, across all categories. */
function summarizeFindings(findings: any): {total: number; bySeverity: Record<string, number>} {
    const summary = {total: 0, bySeverity: {} as Record<string, number>};
    if (!findings || typeof findings !== "object") return summary;

    for (const items of Object.values(findings)) {
        if (!Array.isArray(items)) continue;
        for (const item of items as any[]) {
            summary.total += 1;
            const severity = item?.severity ?? "unspecified";
            summary.bySeverity[severity] = (summary.bySeverity[severity] ?? 0) + 1;
        }
    }
    return summary;
}

async function executeInspections(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchInspectionsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    const units = await unitClause(args, ctx);
    if (units === null) {
        return emptyResult(`No units matched that project/building/unit in this company.`);
    }
    if (units.clause !== undefined) query.unit = units.clause;

    if (args.status) query.status = args.status;
    if (args.type) query.type = args.type;
    if (args.followUpRequired != null) query.followUpRequired = args.followUpRequired;

    const inspected = dateRange(args.inspectedFrom, args.inspectedTo);
    if (inspected) query.inspectionDate = inspected;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const inspections = await inspectionService.find(
        query,
        findOptions(ctx),
        [
            {path: "unit", select: "unitNumber name"},
            {path: "inspectedBy", select: "name surname username"}
        ],
        "name unit inspectedBy inspectionDate scheduledDate type status rating notes findings " +
            "followUpRequired nextInspectionDate completedAt",
        {inspectionDate: -1},
        limit
    );

    const results = inspections.map((i: any) => ({
        id: i._id?.toString(),
        code: i.name ?? null,
        unitNumber: i.unit?.unitNumber ?? i.unit?.name ?? null,
        inspectedBy: userDisplayName(i.inspectedBy),
        type: i.type ?? null,
        status: i.status ?? null,
        inspectionDate: i.inspectionDate ?? null,
        scheduledDate: i.scheduledDate ?? null,
        completedAt: i.completedAt ?? null,
        rating: i.rating ?? null,
        followUpRequired: i.followUpRequired ?? false,
        nextInspectionDate: i.nextInspectionDate ?? null,
        notes: shortText(i.notes, 200),
        findings: summarizeFindings(i.findings)
    }));

    return listResult(inspectionService, query, results, ctx);
}

export const searchInspectionsTool: AssistantTool = {
    name: "search_inspections",
    description:
        "Search unit inspections. Filter by project, building or unit, status " +
        "(scheduled, in_progress, completed, cancelled, rescheduled), type (initial, " +
        "follow_up, final, routine, complaint, pre_sale, post_sale), an inspection-date " +
        "range, or whether a follow-up was flagged. Returns each inspection with its " +
        "unit, inspector, dates, rating and a count of findings by severity, plus " +
        "`total` — the true number of matching inspections. Use this for questions " +
        "about inspections, handover checks or units needing re-inspection.",
    parameters: inspectionParameters,
    execute: executeInspections
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerInspectionsAssistantTools(): void {
    registerAssistantTool(searchInspectionsTool);
}
