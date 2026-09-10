/**
 * `search_documents`, `search_contractors` and `search_warranties` — AI-assistant
 * tools for the project document register, the directory of contractors and
 * consultants the company works with, and the warranties held on delivered work.
 *
 * Answers "where is the as-built drawing for Block A?", "which required
 * deliverables are still missing?", "who are our electrical contractors?",
 * "whose insurance expires this quarter?", "which warranties expire this year?".
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, free
 * text regex-escaped, and every query hard-scoped to `ctx.companyId`. The
 * document tool returns metadata only, never file contents or media URLs.
 *
 * @module documentsAndPartiesTools
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {constructorService} from "@propertyManagement/database/schemas/constructor/constructor.service";
import {constructorPartyTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.schema-def";
import {
    DEFAULT_RESULTS,
    companyScope,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    regexClause,
    shortText,
} from "./assistantToolHelpers";

const PARTY_TYPE_VALUES = [...constructorPartyTypeValues];

// ── search_contractors ───────────────────────────────────────────────────────

const SearchContractorsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        partyType: z.enum(PARTY_TYPE_VALUES as unknown as [string, ...string[]]).optional(),
        trade: z.string().trim().min(1).optional(),
        insuranceExpiringBefore: z.coerce.date().optional(),
        limit: limitArg
    })
    .strip();

const contractorParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the company name, email or website."},
        partyType: {
            type: "string",
            enum: PARTY_TYPE_VALUES,
            description: "Role of the party: contractor, architect, engineer, qs, pm, surveyor, or other."
        },
        trade: {type: "string", description: "Trade they cover, e.g. \"electrical\", \"concrete\"."},
        insuranceExpiringBefore: {
            type: "string",
            description: "ISO date; only parties whose insurance expires on or before this date (compliance check)."
        },
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeContractors(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchContractorsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{name: rx}, {email: rx}, {website: rx}];
    }
    if (args.partyType) query.partyType = args.partyType;
    // `trades` is an array of strings; an equality match on an array field in
    // Mongo matches any element, so this reads as "covers this trade".
    if (args.trade != null) query.trades = regexClause(args.trade);
    if (args.insuranceExpiringBefore != null) {
        query.insuranceExpiry = {$lte: args.insuranceExpiringBefore};
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const contractors = await constructorService.find(
        query,
        findOptions(ctx),
        undefined,
        "name partyType trades email phoneNumber website vat insuranceExpiry performanceScore description",
        {name: 1},
        limit
    );

    const results = contractors.map((c: any) => ({
        id: c._id?.toString(),
        name: c.name ?? null,
        partyType: c.partyType ?? null,
        trades: Array.isArray(c.trades) ? c.trades.slice(0, 10) : [],
        email: c.email ?? null,
        phone: c.phoneNumber ?? null,
        website: c.website ?? null,
        vat: c.vat ?? null,
        insuranceExpiry: c.insuranceExpiry ?? null,
        insuranceExpired: c.insuranceExpiry != null && new Date(c.insuranceExpiry) < new Date(),
        performanceScore: c.performanceScore ?? null,
        description: shortText(c.description, 200)
    }));

    return listResult(constructorService, query, results, ctx);
}

export const searchContractorsTool: AssistantTool = {
    name: "search_contractors",
    description:
        "Search the directory of contractors and consultants the company works with " +
        "(contractors, architects, engineers, QS, PM, surveyors). Filter by free " +
        "text, party type, trade covered, or an insurance-expiry cut-off. Returns " +
        "each party's contact details, trades, VAT number, insurance expiry and " +
        "performance score, plus `total` — the true number of matches. Use this for " +
        "questions about which contractors are available, who does a given trade, or " +
        "whose insurance is lapsing.",
    parameters: contractorParameters,
    execute: executeContractors
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerContractorsAssistantTools(): void {
    registerAssistantTool(searchContractorsTool);
}
