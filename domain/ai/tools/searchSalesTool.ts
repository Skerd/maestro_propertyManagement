/**
 * `search_sales` — AI-assistant tool for closed unit sales, with a revenue
 * rollup computed over the whole match rather than the returned page.
 *
 * Answers "how many units did we sell this month?", "what's our revenue this
 * quarter?", "which sales are still waiting for approval?", "which sold units
 * haven't been handed over yet?".
 *
 * REVENUE IS AGGREGATED, NOT SUMMED FROM THE PAGE. The `results` array is a
 * capped sample; `total` and `revenue` come from separate count/aggregate passes
 * over the full filter, so the model can quote them safely. Revenue is grouped
 * by currency and never converted — there is no FX rate to trust here, and a
 * silently blended total would be a fabricated number.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, with
 * every query (sales find, the count, the revenue aggregate, and the
 * project/building/unit name resolution) hard-scoped to `ctx.companyId`.
 *
 * @module searchSalesTool
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {SaleApprovalStatus, SalePaymentType} from "@propertyManagement/database/schemas/sale/sale";
import {
    DEFAULT_RESULTS,
    companyObjectId,
    companyScope,
    dateRange,
    emptyResult,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    numberRange,
    resolveUnitId,
    resolveUnitIdsForEdifice,
    resolveUnitIdsForProject,
    roundMoney,
    toAmount,
    toNumber,
    userDisplayName
} from "./assistantToolHelpers";

const PAYMENT_TYPE_VALUES = Object.values(SalePaymentType) as string[];
const APPROVAL_STATUS_VALUES = Object.values(SaleApprovalStatus) as string[];

const SearchSalesArgs = z
    .object({
        projectName: z.string().trim().min(1).optional(),
        buildingName: z.string().trim().min(1).optional(),
        unitNumber: z.string().trim().min(1).optional(),
        paymentType: z.enum(PAYMENT_TYPE_VALUES as [string, ...string[]]).optional(),
        approvalStatus: z.enum(APPROVAL_STATUS_VALUES as [string, ...string[]]).optional(),
        soldFrom: z.coerce.date().optional(),
        soldTo: z.coerce.date().optional(),
        minPrice: z.coerce.number().nonnegative().optional(),
        maxPrice: z.coerce.number().nonnegative().optional(),
        handedOver: z.coerce.boolean().optional(),
        titleTransferred: z.coerce.boolean().optional(),
        limit: limitArg
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        projectName: {type: "string", description: "Only sales of units in the project whose name matches this."},
        buildingName: {type: "string", description: "Only sales of units in the building (edifice/block) whose name matches this."},
        unitNumber: {type: "string", description: "Only the sale of this exact unit number (e.g. \"A-102\")."},
        paymentType: {
            type: "string",
            enum: PAYMENT_TYPE_VALUES,
            description: "How the sale is paid: cash, or payment_plan (instalments)."
        },
        approvalStatus: {
            type: "string",
            enum: APPROVAL_STATUS_VALUES,
            description: "Sale approval state, only present when the company requires sale approval."
        },
        soldFrom: {type: "string", description: "ISO date; only sales on or after this date."},
        soldTo: {type: "string", description: "ISO date; only sales on or before this date."},
        minPrice: {type: "number", description: "Minimum final sale price (in the sale's own currency)."},
        maxPrice: {type: "number", description: "Maximum final sale price (in the sale's own currency)."},
        handedOver: {
            type: "boolean",
            description: "true = only sales whose unit has been handed over; false = only those still awaiting handover."
        },
        titleTransferred: {
            type: "boolean",
            description: "true = only sales whose title/deed has been transferred; false = only those still pending."
        },
        limit: limitParameter
    },
    required: [] as string[]
};

/**
 * Sum final prices across the FULL filtered set, grouped by sale currency.
 * `aggregate` bypasses the soft-delete query plugin, so `deletedAt: null` is
 * added by hand — the same caveat the project/building rollups carry.
 */
async function rollUpRevenue(
    query: Record<string, unknown>,
    ctx: AssistantToolContext
): Promise<Array<{currency: string | null; amount: number; sales: number}>> {
    const rows: any[] = await saleService.aggregate(
        [
            {$match: {...query, deletedAt: null}},
            {$group: {_id: "$saleCurrency", amount: {$sum: {$toDouble: "$finalPrice"}}, sales: {$sum: 1}}},
            {$lookup: {from: "currencies", localField: "_id", foreignField: "_id", as: "currency"}}
        ],
        {logger: ctx.logger}
    );

    return rows.map((row) => ({
        currency: row.currency?.[0]?.abbreviation ?? row.currency?.[0]?.symbol ?? null,
        amount: roundMoney(toAmount(row.amount)),
        sales: row.sales ?? 0
    }));
}

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchSalesArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    // A sale has no project/building of its own — it is located through its unit,
    // and the unit ids are resolved inside the company scope first.
    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) return emptyResult(`No unit "${args.unitNumber}" in this company.`);
        query.unit = unitId;
    } else if (args.projectName != null || args.buildingName != null) {
        const name = (args.projectName ?? args.buildingName) as string;
        const unitIds = args.projectName != null
            ? await resolveUnitIdsForProject(args.projectName, ctx)
            : await resolveUnitIdsForEdifice(args.buildingName as string, ctx);
        if (unitIds.length === 0) {
            return emptyResult(`No units found for "${name}" in this company.`);
        }
        query.unit = {$in: unitIds};
    }

    if (args.paymentType) query.paymentType = args.paymentType;
    if (args.approvalStatus) query.approvalStatus = args.approvalStatus;

    const sold = dateRange(args.soldFrom, args.soldTo);
    if (sold) query.saleDate = sold;

    const price = numberRange(args.minPrice, args.maxPrice);
    if (price) query.finalPrice = price;

    // "Handed over" / "title transferred" are recorded as the presence of a date.
    if (args.handedOver === true) query.handoverDate = {$ne: null};
    if (args.handedOver === false) query.handoverDate = null;
    if (args.titleTransferred === true) query.titleTransferDate = {$ne: null};
    if (args.titleTransferred === false) query.titleTransferDate = null;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const sales = await saleService.find(
        query,
        findOptions(ctx),
        [
            {path: "unit", select: "unitNumber name project edifice"},
            {path: "buyer", select: "name surname username email"},
            {path: "soldBy", select: "name surname username"},
            {path: "saleCurrency", select: "symbol abbreviation name"}
        ],
        "name unit buyer soldBy saleDate finalPrice saleCurrency paymentType approvalStatus " +
            "handoverDate titleTransferDate deedNumber transactionReference",
        {saleDate: -1},
        limit
    );

    const results = sales.map((s: any) => ({
        id: s._id?.toString(),
        code: s.name ?? null,
        unitNumber: s.unit?.unitNumber ?? s.unit?.name ?? null,
        buyer: userDisplayName(s.buyer),
        soldBy: userDisplayName(s.soldBy),
        saleDate: s.saleDate ?? null,
        finalPrice: toNumber(s.finalPrice),
        currency: s.saleCurrency?.abbreviation || s.saleCurrency?.symbol || null,
        paymentType: s.paymentType ?? null,
        approvalStatus: s.approvalStatus ?? null,
        handedOver: s.handoverDate != null,
        handoverDate: s.handoverDate ?? null,
        titleTransferred: s.titleTransferDate != null,
        titleTransferDate: s.titleTransferDate ?? null,
        deedNumber: s.deedNumber ?? null
    }));

    const envelope = await listResult(saleService, query, results, ctx);
    const revenue = await rollUpRevenue({...query, company: companyObjectId(ctx)}, ctx);

    return {
        ...envelope,
        // Totals over every matching sale, not just the rows above. Currencies are
        // reported separately and never blended into one figure.
        revenue
    };
}

export const searchSalesTool: AssistantTool = {
    name: "search_sales",
    description:
        "Search the company's completed unit sales by project, building or unit " +
        "number, payment type (cash / payment_plan), approval status, sale-date " +
        "range, price range, or whether handover and title transfer have happened. " +
        "Returns each sale with its unit, buyer, seller, date and final price, plus " +
        "`total` (the true number of matching sales) and `revenue` — the summed sale " +
        "value across ALL matches, grouped by currency. Use this for questions about " +
        "sales, revenue, turnover, closed deals, handovers or title transfers. For " +
        "instalment payments on a sale use search_installments.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerSalesAssistantTools(): void {
    registerAssistantTool(searchSalesTool);
}
