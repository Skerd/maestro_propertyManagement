/**
 * `search_installments` + `search_rental_payments` — AI-assistant tools for the
 * money owed to the company: sale payment-plan instalments, and rent due on
 * leases.
 *
 * Answers "who is behind on payments?", "how much is overdue?", "which
 * instalments are due this month?", "which tenants haven't paid rent?".
 *
 * WHY INSTALMENTS ARE AGGREGATED. Instalments are subdocuments of a PaymentPlan,
 * so a plain find would return whole plans and force the model to count nested
 * rows itself — it would get the arithmetic wrong. Instead the plan array is
 * unwound in the database, filtered there, and both the sample rows and the
 * totals come back from one pipeline. `deletedAt: null` is applied by hand
 * because `aggregate` bypasses the soft-delete query plugin.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, and both
 * the pipeline and every enrichment query are hard-scoped to `ctx.companyId`.
 *
 * @module paymentsTools
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {paymentPlanService} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {rentalPaymentService} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment.service";
import {InstallmentStatus, PaymentPlanStatus} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import {rentalPaymentStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {
    DEFAULT_RESULTS,
    companyObjectId,
    companyScope,
    dateRange,
    daysOverdue,
    emptyResult,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    resolveUnitId,
    roundMoney,
    toAmount,
    toNumber,
    userDisplayName
} from "./assistantToolHelpers";

const INSTALLMENT_STATUS_VALUES = Object.values(InstallmentStatus) as string[];
const PLAN_STATUS_VALUES = Object.values(PaymentPlanStatus) as string[];
const RENTAL_STATUS_VALUES = [...rentalPaymentStatusValues];

// ── search_installments ──────────────────────────────────────────────────────

const SearchInstallmentsArgs = z
    .object({
        status: z.enum(INSTALLMENT_STATUS_VALUES as [string, ...string[]]).optional(),
        planStatus: z.enum(PLAN_STATUS_VALUES as [string, ...string[]]).optional(),
        overdueOnly: z.coerce.boolean().optional(),
        dueFrom: z.coerce.date().optional(),
        dueTo: z.coerce.date().optional(),
        unitNumber: z.string().trim().min(1).optional(),
        limit: limitArg
    })
    .strip();

const installmentParameters = {
    type: "object" as const,
    properties: {
        status: {
            type: "string",
            enum: INSTALLMENT_STATUS_VALUES,
            description: "Instalment status: pending, paid, overdue, partially_paid, or cancelled."
        },
        planStatus: {
            type: "string",
            enum: PLAN_STATUS_VALUES,
            description: "Status of the parent payment plan: active, completed, defaulted, or cancelled."
        },
        overdueOnly: {
            type: "boolean",
            description: "true = only unpaid instalments whose due date has already passed (arrears). Prefer this for \"who owes us money\"."
        },
        dueFrom: {type: "string", description: "ISO date; only instalments due on or after this date."},
        dueTo: {type: "string", description: "ISO date; only instalments due on or before this date."},
        unitNumber: {type: "string", description: "Only instalments on the sale of this unit number."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeInstallments(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchInstallmentsArgs.parse(rawArgs ?? {});
    const limit = args.limit ?? DEFAULT_RESULTS;

    // Stage 1 — which payment plans are in scope. Company-scoped, soft-deletes out.
    const planMatch: Record<string, unknown> = {company: companyObjectId(ctx), deletedAt: null};
    if (args.planStatus) planMatch.status = args.planStatus;

    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) return emptyResult(`No unit "${args.unitNumber}" in this company.`);
        const sales = await saleService.find(
            {...companyScope(ctx), unit: unitId},
            findOptions(ctx),
            undefined,
            "_id",
            undefined,
            100
        );
        const saleIds = sales.map((s: any) => s._id).filter(Boolean);
        if (saleIds.length === 0) {
            return emptyResult(`Unit "${args.unitNumber}" has no sale, so it has no instalments.`);
        }
        planMatch.sale = {$in: saleIds};
    }

    // Stage 2 — which individual instalments qualify, once the array is unwound.
    const installmentMatch: Record<string, unknown> = {};
    if (args.status) installmentMatch["installments.status"] = args.status;

    if (args.overdueOnly === true) {
        // Arrears = still owing AND past due. `status: overdue` alone is not
        // enough: a plan whose status flags haven't been re-run yet would be
        // missed, so the date is checked directly.
        installmentMatch["installments.status"] = {
            $in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE, InstallmentStatus.PARTIALLY_PAID]
        };
        installmentMatch["installments.dueDate"] = {$lt: new Date()};
    } else {
        const due = dateRange(args.dueFrom, args.dueTo);
        if (due) installmentMatch["installments.dueDate"] = due;
    }

    const pipeline: any[] = [
        {$match: planMatch},
        {$unwind: "$installments"},
        ...(Object.keys(installmentMatch).length > 0 ? [{$match: installmentMatch}] : []),
        {$sort: {"installments.dueDate": 1}},
        {
            $facet: {
                rows: [{$limit: limit}],
                totals: [
                    {
                        $group: {
                            _id: null,
                            count: {$sum: 1},
                            amountDue: {$sum: {$toDouble: "$installments.amount"}},
                            amountPaid: {$sum: {$toDouble: {$ifNull: ["$installments.paidAmount", 0]}}}
                        }
                    }
                ]
            }
        }
    ];

    const [facet] = await paymentPlanService.aggregate(pipeline, {logger: ctx.logger});
    const rows: any[] = facet?.rows ?? [];
    const totals = facet?.totals?.[0] ?? {count: 0, amountDue: 0, amountPaid: 0};

    // Enrich the sample rows with unit/buyer, resolved through the sale. Done via
    // the service (company-scoped) rather than a $lookup so the tenant boundary
    // is enforced by the same code path as everywhere else.
    const saleIds = [...new Set(rows.map((r) => r.sale?.toString()).filter(Boolean))];
    const saleById = new Map<string, any>();
    if (saleIds.length > 0) {
        const sales = await saleService.find(
            {...companyScope(ctx), _id: {$in: saleIds.map((id) => new ObjectId(id))}},
            findOptions(ctx),
            [
                {path: "unit", select: "unitNumber name"},
                {path: "buyer", select: "name surname username email"}
            ],
            "unit buyer name",
            undefined,
            saleIds.length
        );
        for (const sale of sales as any[]) {
            saleById.set(sale._id.toString(), sale);
        }
    }

    const results = rows.map((row) => {
        const installment = row.installments ?? {};
        const sale = saleById.get(row.sale?.toString());
        const overdueDays = daysOverdue(installment.dueDate);
        const isSettled = installment.status === InstallmentStatus.PAID
            || installment.status === InstallmentStatus.CANCELLED;
        return {
            planId: row._id?.toString(),
            planCode: row.name ?? null,
            planStatus: row.status ?? null,
            saleCode: sale?.name ?? null,
            unitNumber: sale?.unit?.unitNumber ?? sale?.unit?.name ?? null,
            buyer: userDisplayName(sale?.buyer),
            installmentNumber: installment.installmentNumber ?? null,
            dueDate: installment.dueDate ?? null,
            amount: toNumber(installment.amount),
            paidAmount: toNumber(installment.paidAmount),
            status: installment.status ?? null,
            daysOverdue: !isSettled && overdueDays != null && overdueDays > 0 ? overdueDays : 0
        };
    });

    const amountDue = roundMoney(toAmount(totals.amountDue));
    const amountPaid = roundMoney(toAmount(totals.amountPaid));

    return {
        // Totals span every matching instalment, not just the rows below.
        total: totals.count ?? 0,
        returned: results.length,
        truncated: (totals.count ?? 0) > results.length,
        totals: {
            amountDue,
            amountPaid,
            outstanding: roundMoney(amountDue - amountPaid)
        },
        note: "Amounts are summed across all matching instalments and are NOT currency-converted; " +
            "each payment plan carries its own sale currency.",
        results
    };
}

export const searchInstallmentsTool: AssistantTool = {
    name: "search_installments",
    description:
        "Search sale payment-plan instalments — the money buyers owe on units they " +
        "are buying by instalments. Filter by instalment status, parent plan status, " +
        "a due-date range, a specific unit, or `overdueOnly` for arrears. Returns " +
        "sample instalments with unit, buyer, due date, amount and days overdue, plus " +
        "`total` (the true number of matching instalments) and `totals.outstanding` " +
        "(amount still owed across ALL matches). Use this for questions about " +
        "instalments, arrears, overdue buyer payments, or who owes money on a sale. " +
        "For rent owed by tenants use search_rental_payments.",
    parameters: installmentParameters,
    execute: executeInstallments
};

// ── search_rental_payments ───────────────────────────────────────────────────

const SearchRentalPaymentsArgs = z
    .object({
        status: z.enum(RENTAL_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        overdueOnly: z.coerce.boolean().optional(),
        dueFrom: z.coerce.date().optional(),
        dueTo: z.coerce.date().optional(),
        unitNumber: z.string().trim().min(1).optional(),
        limit: limitArg
    })
    .strip();

const rentalParameters = {
    type: "object" as const,
    properties: {
        status: {
            type: "string",
            enum: RENTAL_STATUS_VALUES,
            description: "Rent payment status: pending, paid, overdue, or waived."
        },
        overdueOnly: {
            type: "boolean",
            description: "true = only unpaid rent whose due date has passed. Prefer this for \"which tenants are behind\"."
        },
        dueFrom: {type: "string", description: "ISO date; only rent due on or after this date."},
        dueTo: {type: "string", description: "ISO date; only rent due on or before this date."},
        unitNumber: {type: "string", description: "Only rent payments for this unit number."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeRentalPayments(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchRentalPaymentsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) return emptyResult(`No unit "${args.unitNumber}" in this company.`);
        query.unit = unitId;
    }

    if (args.overdueOnly === true) {
        query.status = {$in: ["pending", "overdue"]};
        query.dueDate = {$lt: new Date()};
    } else {
        if (args.status) query.status = args.status;
        const due = dateRange(args.dueFrom, args.dueTo);
        if (due) query.dueDate = due;
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const payments = await rentalPaymentService.find(
        query,
        findOptions(ctx),
        [
            {path: "unit", select: "unitNumber name"},
            {path: "lease", select: "name tenant"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name lease unit dueDate amount currency status paidDate paidAmount",
        {dueDate: 1},
        limit
    );

    const results = payments.map((p: any) => {
        const overdueDays = daysOverdue(p.dueDate);
        const settled = p.status === "paid" || p.status === "waived";
        return {
            id: p._id?.toString(),
            code: p.name ?? null,
            unitNumber: p.unit?.unitNumber ?? p.unit?.name ?? null,
            leaseCode: p.lease?.name ?? null,
            dueDate: p.dueDate ?? null,
            amount: toNumber(p.amount),
            currency: p.currency?.abbreviation || p.currency?.symbol || null,
            status: p.status ?? null,
            paidDate: p.paidDate ?? null,
            paidAmount: toNumber(p.paidAmount),
            daysOverdue: !settled && overdueDays != null && overdueDays > 0 ? overdueDays : 0
        };
    });

    return listResult(rentalPaymentService, query, results, ctx);
}

export const searchRentalPaymentsTool: AssistantTool = {
    name: "search_rental_payments",
    description:
        "Search rent payments due on leases — the money tenants owe. Filter by " +
        "status (pending, paid, overdue, waived), a due-date range, a specific unit, " +
        "or `overdueOnly` for rent in arrears. Returns each payment with its unit, " +
        "lease, due date, amount, paid amount and days overdue, plus `total` — the " +
        "true number of matching payments. Use this for questions about rent " +
        "collection, late tenants, or rental income due. For buyer instalments on a " +
        "sale use search_installments.",
    parameters: rentalParameters,
    execute: executeRentalPayments
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPaymentsAssistantTools(): void {
    registerAssistantTool(searchInstallmentsTool);
    registerAssistantTool(searchRentalPaymentsTool);
}
