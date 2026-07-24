/**
 * `search_permits` — AI-assistant tool for the construction permit register.
 *
 * Answers "which permits are expiring this quarter?", "show pending building
 * permits", "what's the status of the fire permit for edifice X?". Queries real
 * Permit records, hard-scoped to the calling human's company, excluding
 * soft-deleted rows. Registered into the core tool registry at startup.
 *
 * SECURITY: arguments are untrusted LLM output. They are re-validated with Zod;
 * every query carries `company: ObjectId(ctx.companyId)`; and the free-text
 * `search` term is regex-escaped before use so it cannot inject an operator.
 *
 * @module searchPermitsTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {permitService} from "@propertyManagement/database/schemas/permit/permit.service";
import {permitStatusValues, permitTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/permit.schema-def";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;

/** Escape a user/model-supplied string for safe use inside a RegExp. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SearchPermitsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        status: z.enum(permitStatusValues as unknown as [string, ...string[]]).optional(),
        permitType: z.enum(permitTypeValues as unknown as [string, ...string[]]).optional(),
        expiringBefore: z.coerce.date().optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        search: {
            type: "string",
            description: "Free text matched against the permit's title, authority or reference number."
        },
        status: {
            type: "string",
            enum: [...permitStatusValues],
            description: "Permit workflow status: draft, submitted, under_review, approved, rejected, or expired."
        },
        permitType: {
            type: "string",
            enum: [...permitTypeValues],
            description: "Permit type: building, excavation, environmental, fire, utility, occupancy, zoning, other."
        },
        expiringBefore: {
            type: "string",
            description: "ISO date; only permits that expire on or before this date (find upcoming expiries)."
        },
        limit: {
            type: "integer",
            description: `Maximum number of results (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchPermitsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    if (args.search != null) {
        const rx = {$regex: escapeRegex(args.search), $options: "i"};
        query.$or = [{title: rx}, {authority: rx}, {referenceNumber: rx}, {name: rx}];
    }
    if (args.status) query.status = args.status;
    if (args.permitType) query.permitType = args.permitType;
    if (args.expiringBefore != null) query.expiresAt = {$lte: args.expiringBefore};

    const limit = args.limit ?? DEFAULT_RESULTS;

    const permits = await permitService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"}
        ],
        "name title permitType authority referenceNumber status submittedAt approvedAt expiresAt project edifice",
        {expiresAt: 1},
        limit
    );

    const results = permits.map((p: any) => ({
        id: p._id?.toString(),
        code: p.name ?? null,
        title: p.title ?? null,
        permitType: p.permitType ?? null,
        authority: p.authority ?? null,
        referenceNumber: p.referenceNumber ?? null,
        status: p.status ?? null,
        project: p.project?.name ?? null,
        edifice: p.edifice?.name ?? null,
        submittedAt: p.submittedAt ?? null,
        approvedAt: p.approvedAt ?? null,
        expiresAt: p.expiresAt ?? null
    }));

    return {count: results.length, capped: results.length >= limit, results};
}

export const searchPermitsTool: AssistantTool = {
    name: "search_permits",
    description:
        "Search the company's construction/authority permits (building, excavation, " +
        "environmental, fire, utility, occupancy, zoning) by title, authority or " +
        "reference number, workflow status, type, or an expiry cut-off date. Returns " +
        "each permit with its status, authority, dates and linked project/edifice. " +
        "Use this for questions about permits, licences, authority approvals or " +
        "permit expiries.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPermitsAssistantTools(): void {
    registerAssistantTool(searchPermitsTool);
}
