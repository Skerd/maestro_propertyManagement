/**
 * `search_leads` — AI-assistant tool for the CRM contacts/leads (prospective
 * buyers).
 *
 * Answers "who are my new leads?", "show qualified leads from referrals", "find
 * the contact John with budget over 200k", "which leads need follow-up this
 * week?". Queries real Lead records, hard-scoped to the calling human's company,
 * excluding soft-deleted rows. Registered into the core tool registry at startup;
 * the brain (core) never imports this module directly.
 *
 * SECURITY: arguments are untrusted LLM output. They are re-validated with Zod;
 * every query carries `company: ObjectId(ctx.companyId)`; and the free-text
 * `search` term is regex-escaped before use so it cannot inject an operator.
 *
 * @module searchLeadsTool
 */

import {Decimal128, ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {leadService} from "@propertyManagement/database/schemas/lead/lead.service";
import {LeadStatus, LeadSource} from "@propertyManagement/database/schemas/lead/lead";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;

const LEAD_STATUS_VALUES = Object.values(LeadStatus) as string[];
const LEAD_SOURCE_VALUES = Object.values(LeadSource) as string[];

/** Escape a user/model-supplied string for safe use inside a RegExp. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse a Decimal128 amount into a plain number for the JSON result. */
function amountToNumber(amount: unknown): number | null {
    if (amount == null) return null;
    const n = parseFloat(amount.toString());
    return Number.isFinite(n) ? n : null;
}

const SearchLeadsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        status: z.enum(LEAD_STATUS_VALUES as [string, ...string[]]).optional(),
        source: z.enum(LEAD_SOURCE_VALUES as [string, ...string[]]).optional(),
        minBudget: z.coerce.number().nonnegative().optional(),
        maxBudget: z.coerce.number().nonnegative().optional(),
        followUpBefore: z.coerce.date().optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        search: {
            type: "string",
            description: "Free text matched against the lead's first/last name, email or phone."
        },
        status: {
            type: "string",
            enum: LEAD_STATUS_VALUES,
            description: "Pipeline stage: new, contacted, qualified, proposal, negotiation, won, or lost."
        },
        source: {
            type: "string",
            enum: LEAD_SOURCE_VALUES,
            description: "Where the lead came from: website, referral, social, event, cold_call, walk_in, other."
        },
        minBudget: {type: "number", description: "Minimum lead budget (in the lead's own currency)."},
        maxBudget: {type: "number", description: "Maximum lead budget (in the lead's own currency)."},
        followUpBefore: {
            type: "string",
            description: "ISO date; only leads whose follow-up date is on or before this (find due follow-ups)."
        },
        limit: {
            type: "integer",
            description: `Maximum number of results (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchLeadsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    if (args.search != null) {
        const rx = {$regex: escapeRegex(args.search), $options: "i"};
        query.$or = [{firstName: rx}, {lastName: rx}, {email: rx}, {phone: rx}];
    }
    if (args.status) query.status = args.status;
    if (args.source) query.source = args.source;
    if (args.followUpBefore != null) query.followUpDate = {$lte: args.followUpBefore};

    if (args.minBudget != null || args.maxBudget != null) {
        const budget: Record<string, Decimal128> = {};
        if (args.minBudget != null) budget.$gte = Decimal128.fromString(String(args.minBudget));
        if (args.maxBudget != null) budget.$lte = Decimal128.fromString(String(args.maxBudget));
        query.budget = budget;
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const leads = await leadService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "projectInterest", select: "name"},
            {path: "unitInterest", select: "unitNumber name"},
            {path: "budgetCurrency", select: "symbol abbreviation name"},
            {path: "assignedTo", select: "name surname username"}
        ],
        "name firstName lastName email phone status source budget budgetCurrency " +
            "projectInterest unitInterest assignedTo followUpDate convertedAt",
        {followUpDate: 1},
        limit
    );

    const results = leads.map((l: any) => ({
        id: l._id?.toString(),
        code: l.name ?? null,
        name: [l.firstName, l.lastName].filter(Boolean).join(" ").trim() || null,
        email: l.email ?? null,
        phone: l.phone ?? null,
        status: l.status ?? null,
        source: l.source ?? null,
        budget: amountToNumber(l.budget),
        currency: l.budgetCurrency?.abbreviation || l.budgetCurrency?.symbol || null,
        projectInterest: l.projectInterest?.name ?? null,
        unitInterest: l.unitInterest?.unitNumber ?? l.unitInterest?.name ?? null,
        assignedTo:
            [l.assignedTo?.name, l.assignedTo?.surname].filter(Boolean).join(" ").trim() ||
            l.assignedTo?.username ||
            null,
        followUpDate: l.followUpDate ?? null,
        convertedAt: l.convertedAt ?? null
    }));

    return {count: results.length, capped: results.length >= limit, results};
}

export const searchLeadsTool: AssistantTool = {
    name: "search_leads",
    description:
        "Search the company's CRM leads/contacts (prospective buyers/clients) by " +
        "name, email or phone (free-text `search`), pipeline status (new, contacted, " +
        "qualified, proposal, negotiation, won, lost), source, budget range, or a " +
        "follow-up-due date. Returns each lead with contact details, status, budget, " +
        "interests and who it's assigned to. Use this for questions about leads, " +
        "contacts, clients, prospects, or the sales pipeline.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerLeadsAssistantTools(): void {
    registerAssistantTool(searchLeadsTool);
}
