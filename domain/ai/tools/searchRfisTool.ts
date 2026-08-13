/**
 * `search_rfis` — AI-assistant tool for site Requests for Information.
 *
 * Answers "which RFIs are still open?", "show overdue RFIs on project X",
 * "what was asked about the facade drawings?". Queries real Rfi records,
 * hard-scoped to the calling human's company, excluding soft-deleted rows.
 * Registered into the core tool registry at startup.
 *
 * SECURITY: arguments are untrusted LLM output. They are re-validated with Zod;
 * every query carries `company: ObjectId(ctx.companyId)`; and the free-text
 * `search` term is regex-escaped before use so it cannot inject an operator.
 *
 * @module searchRfisTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {rfiService} from "@propertyManagement/database/schemas/rfi/rfi.service";
import {rfiStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/rfi.schema-def";
import {limitParameter, listResult} from "./assistantToolHelpers";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;

/** Escape a user/model-supplied string for safe use inside a RegExp. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SearchRfisArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        status: z.enum(rfiStatusValues as unknown as [string, ...string[]]).optional(),
        overdueOnly: z.coerce.boolean().optional(),
        dueBefore: z.coerce.date().optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        search: {
            type: "string",
            description: "Free text matched against the RFI's title or question."
        },
        status: {
            type: "string",
            enum: [...rfiStatusValues],
            description: "RFI status: open, answered, closed, or void."
        },
        overdueOnly: {
            type: "boolean",
            description: "If true, only open RFIs whose due date has already passed."
        },
        dueBefore: {
            type: "string",
            description: "ISO date; only RFIs due on or before this date."
        },
        limit: limitParameter
    },
    required: [] as string[]
};

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchRfisArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    if (args.search != null) {
        const rx = {$regex: escapeRegex(args.search), $options: "i"};
        query.$or = [{title: rx}, {question: rx}, {name: rx}];
    }
    if (args.status) query.status = args.status;
    if (args.overdueOnly) {
        query.status = "open";
        query.dueDate = {$lt: new Date()};
    } else if (args.dueBefore != null) {
        query.dueDate = {$lte: args.dueBefore};
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const rfis = await rfiService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "askedBy", select: "name surname username"},
            {path: "answeredBy", select: "name surname username"}
        ],
        "name title question answer status dueDate project edifice askedBy answeredBy createdAt",
        {dueDate: 1},
        limit
    );

    function userName(u: any): string | null {
        return [u?.name, u?.surname].filter(Boolean).join(" ").trim() || u?.username || null;
    }

    const results = rfis.map((r: any) => ({
        id: r._id?.toString(),
        code: r.name ?? null,
        title: r.title ?? null,
        question: r.question ?? null,
        answer: r.answer ?? null,
        status: r.status ?? null,
        dueDate: r.dueDate ?? null,
        overdue: r.status === "open" && r.dueDate != null && new Date(r.dueDate) < new Date(),
        project: r.project?.name ?? null,
        edifice: r.edifice?.name ?? null,
        askedBy: userName(r.askedBy),
        answeredBy: userName(r.answeredBy),
        createdAt: r.createdAt ?? null
    }));

    return listResult(rfiService, query, results, ctx);
}

export const searchRfisTool: AssistantTool = {
    name: "search_rfis",
    description:
        "Search the company's construction RFIs (Requests for Information between " +
        "site/contractor and the design team) by title or question text, status " +
        "(open, answered, closed, void), overdue flag, or a due-date cut-off. " +
        "Returns each RFI with its question, answer, status, due date and who " +
        "asked/answered. Use this for questions about RFIs, open site questions, " +
        "or overdue contractor queries.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerRfisAssistantTools(): void {
    registerAssistantTool(searchRfisTool);
}
