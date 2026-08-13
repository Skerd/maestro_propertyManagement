/**
 * `portfolio_overview` — one-call health check across the whole company.
 *
 * Answers the broad opening questions a chat gets constantly: "how are we
 * doing?", "give me a summary", "what needs my attention today?". Without this
 * the model has to fire six or seven search tools and stitch the numbers
 * together, which is slow and gives it room to miscount.
 *
 * EVERY FIGURE HERE IS A COUNT OR AN AGGREGATE over the full company scope — no
 * sampling, no page sizes. Money is grouped by currency and never converted, and
 * the sales window is explicit so "this month" is never assumed silently.
 *
 * SECURITY: the only argument is a day window; there is nothing here the model
 * can widen. Every query carries `company: ObjectId(ctx.companyId)`, and the
 * aggregates add `deletedAt: null` by hand because `aggregate` bypasses the
 * soft-delete query plugin.
 *
 * @module portfolioOverviewTool
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {leadService} from "@propertyManagement/database/schemas/lead/lead.service";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {leaseService} from "@propertyManagement/database/schemas/lease/lease.service";
import {snagService} from "@propertyManagement/database/schemas/snag/snag.service";
import {rentalPaymentService} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment.service";
import {paymentPlanService} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan.service";
import {milestoneService} from "@propertyManagement/database/schemas/milestone/milestone.service";
import {contractorInvoiceService} from "@propertyManagement/database/schemas/contractorInvoice/contractorInvoice.service";
import {permitService} from "@propertyManagement/database/schemas/permit/permit.service";
import {InstallmentStatus} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import {companyObjectId, companyScope, roundMoney, toAmount} from "./assistantToolHelpers";

/** Default reporting window for the "recent activity" figures. */
const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const MS_PER_DAY = 86_400_000;

const PortfolioOverviewArgs = z
    .object({
        windowDays: z.coerce.number().int().positive().max(MAX_WINDOW_DAYS).optional()
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        windowDays: {
            type: "integer",
            description:
                `How many days back the "recent" figures (sales, new leads, incidents) should cover. ` +
                `Default ${DEFAULT_WINDOW_DAYS}, max ${MAX_WINDOW_DAYS}. Use 30 for "this month", 7 for "this week".`
        }
    },
    required: [] as string[]
};

/** Count units by status across the whole company, in one aggregation. */
async function unitBreakdown(ctx: AssistantToolContext): Promise<{total: number; byStatus: Record<string, number>}> {
    const rows: any[] = await unitService.aggregate(
        [
            {$match: {company: companyObjectId(ctx), deletedAt: null}},
            {$group: {_id: "$status", count: {$sum: 1}}}
        ],
        {logger: ctx.logger}
    );

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
        const count = row.count ?? 0;
        byStatus[row._id ?? "unknown"] = count;
        total += count;
    }
    return {total, byStatus};
}

/** Sum sales in the window, grouped by currency (never blended into one figure). */
async function salesInWindow(
    since: Date,
    ctx: AssistantToolContext
): Promise<{count: number; revenue: Array<{currency: string | null; amount: number}>}> {
    const rows: any[] = await saleService.aggregate(
        [
            {$match: {company: companyObjectId(ctx), deletedAt: null, saleDate: {$gte: since}}},
            {$group: {_id: "$saleCurrency", amount: {$sum: {$toDouble: "$finalPrice"}}, count: {$sum: 1}}},
            {$lookup: {from: "currencies", localField: "_id", foreignField: "_id", as: "currency"}}
        ],
        {logger: ctx.logger}
    );

    return {
        count: rows.reduce((sum, row) => sum + (row.count ?? 0), 0),
        revenue: rows.map((row) => ({
            currency: row.currency?.[0]?.abbreviation ?? row.currency?.[0]?.symbol ?? null,
            amount: roundMoney(toAmount(row.amount))
        }))
    };
}

/** Overdue sale instalments: how many, and how much is still outstanding. */
async function installmentArrears(ctx: AssistantToolContext): Promise<{count: number; outstanding: number}> {
    const rows: any[] = await paymentPlanService.aggregate(
        [
            {$match: {company: companyObjectId(ctx), deletedAt: null}},
            {$unwind: "$installments"},
            {
                $match: {
                    "installments.status": {
                        $in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE, InstallmentStatus.PARTIALLY_PAID]
                    },
                    "installments.dueDate": {$lt: new Date()}
                }
            },
            {
                $group: {
                    _id: null,
                    count: {$sum: 1},
                    due: {$sum: {$toDouble: "$installments.amount"}},
                    paid: {$sum: {$toDouble: {$ifNull: ["$installments.paidAmount", 0]}}}
                }
            }
        ],
        {logger: ctx.logger}
    );

    const row = rows[0] ?? {count: 0, due: 0, paid: 0};
    return {
        count: row.count ?? 0,
        outstanding: roundMoney(toAmount(row.due) - toAmount(row.paid))
    };
}

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = PortfolioOverviewArgs.parse(rawArgs ?? {});
    const windowDays = args.windowDays ?? DEFAULT_WINDOW_DAYS;
    const now = new Date();
    const since = new Date(now.getTime() - windowDays * MS_PER_DAY);
    const soon = new Date(now.getTime() + 30 * MS_PER_DAY);

    const scope = companyScope(ctx);
    const countOptions = {logger: ctx.logger, withDeleted: false};

    // All independent — issued together so a summary is one round trip's latency.
    const [
        units,
        sales,
        arrears,
        newLeads,
        openLeads,
        activeReservations,
        activeLeases,
        overdueRent,
        openSnags,
        overdueSnags,
        lateMilestones,
        unpaidInvoices,
        permitsExpiringSoon
    ] = await Promise.all([
        unitBreakdown(ctx),
        salesInWindow(since, ctx),
        installmentArrears(ctx),
        leadService.count({...scope, createdAt: {$gte: since}}, countOptions),
        leadService.count({...scope, status: {$nin: ["won", "lost"]}}, countOptions),
        reservationService.count({...scope, status: "active"}, countOptions),
        leaseService.count({...scope, status: "active"}, countOptions),
        rentalPaymentService.count(
            {...scope, status: {$in: ["pending", "overdue"]}, dueDate: {$lt: now}},
            countOptions
        ),
        snagService.count({...scope, status: {$in: ["open", "in_progress"]}}, countOptions),
        snagService.count(
            {...scope, status: {$in: ["open", "in_progress"]}, dueDate: {$lt: now}},
            countOptions
        ),
        milestoneService.count(
            {
                ...scope,
                $or: [
                    {status: "delayed"},
                    {status: {$in: ["planned", "in_progress"]}, plannedEnd: {$lt: now}}
                ]
            },
            countOptions
        ),
        contractorInvoiceService.count(
            {...scope, status: {$in: ["received", "under_review", "approved"]}},
            countOptions
        ),
        permitService.count({...scope, expiresAt: {$gte: now, $lte: soon}}, countOptions)
    ]);

    return {
        windowDays,
        windowStart: since,
        generatedAt: now,
        portfolio: {
            units: units.total,
            unitsByStatus: units.byStatus,
            activeReservations,
            activeLeases
        },
        sales: {
            inWindow: sales.count,
            // Grouped by currency; do not add these together.
            revenueInWindow: sales.revenue
        },
        pipeline: {
            newLeadsInWindow: newLeads,
            openLeads
        },
        money: {
            overdueInstallments: arrears.count,
            overdueInstallmentsOutstanding: arrears.outstanding,
            overdueRentPayments: overdueRent,
            unpaidContractorInvoices: unpaidInvoices
        },
        delivery: {
            openSnags,
            overdueSnags,
            lateMilestones,
            permitsExpiringWithin30Days: permitsExpiringSoon
        },
        notes: [
            "All figures are real counts/aggregates over the whole company — not samples.",
            "Money is grouped by currency and never converted; do not sum across currencies.",
            "Use the specific search_* tools to drill into any number above."
        ]
    };
}

export const portfolioOverviewTool: AssistantTool = {
    name: "portfolio_overview",
    description:
        "Get a single company-wide snapshot: unit counts by status, active " +
        "reservations and leases, sales and revenue in a recent window, new and open " +
        "leads, overdue buyer instalments and rent, unpaid contractor invoices, open " +
        "and overdue defects, late milestones, and permits expiring soon. Use this " +
        "FIRST for broad questions like \"how are we doing?\", \"give me a summary\", " +
        "\"what needs attention?\" — it replaces firing several search tools. Then " +
        "use the specific search_* tools to drill into any figure.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPortfolioOverviewAssistantTools(): void {
    registerAssistantTool(portfolioOverviewTool);
}
