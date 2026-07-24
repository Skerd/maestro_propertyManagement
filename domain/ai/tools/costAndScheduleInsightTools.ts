/**
 * `budget_variance` + `milestone_risk` — AI-assistant insight tools for the
 * delivery/cost side of propertyManagement.
 *
 * `budget_variance` answers "how is the budget tracking on project X?",
 * "which trades are over budget?" — aggregating BoqItem planned vs actual and
 * ConstructionContract cost truth (contract value, approved VOs, certified
 * claims). `milestone_risk` answers "which milestones are slipping?" —
 * flagging delayed milestones and planned milestones past their planned end.
 *
 * SECURITY: arguments are untrusted LLM output. They are re-validated with Zod
 * and every query carries `company: ObjectId(ctx.companyId)`.
 *
 * @module costAndScheduleInsightTools
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {budgetService} from "@propertyManagement/database/schemas/budget/budget.service";
import {boqItemService} from "@propertyManagement/database/schemas/boqItem/boqItem.service";
import {constructionContractService} from "@propertyManagement/database/schemas/constructionContract/constructionContract.service";
import {milestoneService} from "@propertyManagement/database/schemas/milestone/milestone.service";

const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;

function toNum(v: unknown): number {
    if (v == null) return 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}

// ── budget_variance ──────────────────────────────────────────────────────────

const BudgetVarianceArgs = z
    .object({
        projectId: z.string().trim().refine((v) => ObjectId.isValid(v), "invalid projectId").optional()
    })
    .strip();

const budgetVarianceParameters = {
    type: "object" as const,
    properties: {
        projectId: {
            type: "string",
            description: "Optional project id to scope the variance report; omit for the whole company."
        }
    },
    required: [] as string[]
};

async function executeBudgetVariance(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = BudgetVarianceArgs.parse(rawArgs ?? {});
    const companyScope: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};
    if (args.projectId) companyScope.project = new ObjectId(args.projectId);
    const findOpts = {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false};

    const budgets = await budgetService.find(
        companyScope,
        findOpts,
        [{path: "project", select: "name"}],
        "name title version status approvedTotal contingencyPercent project",
        {createdAt: -1},
        MAX_RESULTS
    );

    const boqItems = await boqItemService.find(
        companyScope,
        findOpts,
        [],
        "trade category plannedAmount actualAmount status",
        {},
        10_000
    );

    const byTrade: Record<string, {planned: number; actual: number}> = {};
    let plannedTotal = 0;
    let actualTotal = 0;
    for (const item of boqItems as any[]) {
        if (item.status === "cancelled") continue;
        const trade = String(item.trade ?? item.category ?? "unassigned");
        const planned = toNum(item.plannedAmount);
        const actual = toNum(item.actualAmount);
        byTrade[trade] = byTrade[trade] ?? {planned: 0, actual: 0};
        byTrade[trade].planned += planned;
        byTrade[trade].actual += actual;
        plannedTotal += planned;
        actualTotal += actual;
    }

    const contracts = await constructionContractService.find(
        companyScope,
        findOpts,
        [{path: "constructorRef", select: "name"}],
        "name title status contractValue approvedVariationsTotal certifiedClaimsTotal constructorRef",
        {},
        MAX_RESULTS
    );

    return {
        budgets: (budgets as any[]).map((b) => ({
            id: b._id?.toString(),
            title: b.title ?? b.name ?? null,
            project: b.project?.name ?? null,
            version: b.version ?? null,
            status: b.status ?? null,
            approvedTotal: b.approvedTotal != null ? toNum(b.approvedTotal) : null,
            contingencyPercent: b.contingencyPercent ?? null
        })),
        boq: {
            plannedTotal,
            actualTotal,
            variance: plannedTotal - actualTotal,
            byTrade: Object.entries(byTrade).map(([trade, v]) => ({
                trade,
                planned: v.planned,
                actual: v.actual,
                variance: v.planned - v.actual
            }))
        },
        contracts: (contracts as any[]).map((c) => {
            const value = toNum(c.contractValue);
            const variations = toNum(c.approvedVariationsTotal);
            const certified = toNum(c.certifiedClaimsTotal);
            return {
                id: c._id?.toString(),
                title: c.title ?? c.name ?? null,
                constructor: c.constructorRef?.name ?? null,
                status: c.status ?? null,
                contractValue: value,
                approvedVariationsTotal: variations,
                certifiedClaimsTotal: certified,
                remainingToCertify: value + variations - certified
            };
        })
    };
}

export const budgetVarianceTool: AssistantTool = {
    name: "budget_variance",
    description:
        "Summarize construction cost health for the company or one project: budgets " +
        "with approved totals, BOQ planned vs actual amounts grouped by trade (with " +
        "variance), and each construction contract's value, approved variation " +
        "orders, certified progress claims and remaining amount to certify. Use this " +
        "for questions about budget variance, cost overruns, trades over budget, or " +
        "contract cost position.",
    parameters: budgetVarianceParameters,
    execute: executeBudgetVariance
};

// ── milestone_risk ───────────────────────────────────────────────────────────

const MilestoneRiskArgs = z
    .object({
        projectId: z.string().trim().refine((v) => ObjectId.isValid(v), "invalid projectId").optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const milestoneRiskParameters = {
    type: "object" as const,
    properties: {
        projectId: {
            type: "string",
            description: "Optional project id to scope the risk report; omit for the whole company."
        },
        limit: {
            type: "integer",
            description: `Maximum number of at-risk milestones (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

async function executeMilestoneRisk(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = MilestoneRiskArgs.parse(rawArgs ?? {});
    const limit = args.limit ?? DEFAULT_RESULTS;
    const now = new Date();

    const query: Record<string, unknown> = {
        company: new ObjectId(ctx.companyId),
        $or: [
            {status: "delayed"},
            {status: {$in: ["planned", "in_progress"]}, plannedEnd: {$lt: now}}
        ]
    };
    if (args.projectId) query.project = new ObjectId(args.projectId);

    const milestones = await milestoneService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"}
        ],
        "name title status plannedStart plannedEnd actualStart actualEnd weightPercent project edifice",
        {plannedEnd: 1},
        limit
    );

    const results = (milestones as any[]).map((m) => {
        const plannedEnd = m.plannedEnd ? new Date(m.plannedEnd) : null;
        const daysOverdue = plannedEnd && plannedEnd < now
            ? Math.floor((now.getTime() - plannedEnd.getTime()) / 86_400_000)
            : 0;
        return {
            id: m._id?.toString(),
            code: m.name ?? null,
            title: m.title ?? null,
            status: m.status ?? null,
            project: m.project?.name ?? null,
            edifice: m.edifice?.name ?? null,
            plannedStart: m.plannedStart ?? null,
            plannedEnd: m.plannedEnd ?? null,
            actualStart: m.actualStart ?? null,
            weightPercent: m.weightPercent ?? null,
            daysOverdue
        };
    });

    return {count: results.length, capped: results.length >= limit, results};
}

export const milestoneRiskTool: AssistantTool = {
    name: "milestone_risk",
    description:
        "List at-risk construction milestones for the company or one project: " +
        "milestones marked delayed, plus planned/in-progress milestones whose " +
        "planned end date has already passed, with days overdue and schedule " +
        "weight. Use this for questions about schedule slippage, delayed " +
        "milestones or programme risk.",
    parameters: milestoneRiskParameters,
    execute: executeMilestoneRisk
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerCostAndScheduleAssistantTools(): void {
    registerAssistantTool(budgetVarianceTool);
    registerAssistantTool(milestoneRiskTool);
}
