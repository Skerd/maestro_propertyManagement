/**
 * `search_contracts`, `search_progress_claims`, `search_variation_orders` and
 * `search_contractor_invoices` — AI-assistant tools for the contractor side of a
 * build: what was agreed, what has been claimed and certified, what changed, and
 * what has been invoiced.
 *
 * Answers "what's left to certify on the main contract?", "which claims are
 * awaiting certification?", "what variation orders are pending approval?", "how
 * much is unpaid to contractors?".
 *
 * These four are separate tools rather than one, because each answers a
 * different question with a different status vocabulary — collapsing them would
 * force the model to guess which status enum applies.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, free
 * text regex-escaped, and every query hard-scoped to `ctx.companyId`.
 *
 * @module contractsAndClaimsTools
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {constructionContractService} from "@propertyManagement/database/schemas/constructionContract/constructionContract.service";
import {progressClaimService} from "@propertyManagement/database/schemas/progressClaim/progressClaim.service";
import {variationOrderService} from "@propertyManagement/database/schemas/variationOrder/variationOrder.service";
import {contractorInvoiceService} from "@propertyManagement/database/schemas/contractorInvoice/contractorInvoice.service";
import {constructorService} from "@propertyManagement/database/schemas/constructor/constructor.service";
import {constructionContractStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/constructionContract.schema-def";
import {progressClaimStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/progressClaim/progressClaim.schema-def";
import {variationOrderStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/variationOrder.schema-def";
import {contractorInvoiceStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/contractorInvoice.schema-def";
import {
    DEFAULT_RESULTS,
    companyScope,
    dateRange,
    daysOverdue,
    emptyResult,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    regexClause,
    resolveProjectIds,
    roundMoney,
    shortText,
    toAmount,
    toNumber
} from "./assistantToolHelpers";

const CONTRACT_STATUS_VALUES = [...constructionContractStatusValues];
const CLAIM_STATUS_VALUES = [...progressClaimStatusValues];
const VARIATION_STATUS_VALUES = [...variationOrderStatusValues];
const INVOICE_STATUS_VALUES = [...contractorInvoiceStatusValues];

/** Variation-order statuses that are still working through the approval chain. */
const PENDING_VARIATION_STATUSES = ["pending_architect", "pending_qs", "pending_client"];
/** Contractor-invoice statuses that mean money is still owed. */
const UNPAID_INVOICE_STATUSES = ["received", "under_review", "approved"];

/**
 * Apply a project-name filter, returning `false` when the name matched nothing
 * so the caller can return an empty result instead of widening the answer.
 */
async function applyProjectFilter(
    query: Record<string, unknown>,
    projectName: string | undefined,
    ctx: AssistantToolContext
): Promise<boolean> {
    if (projectName == null) return true;
    const projectIds = await resolveProjectIds(projectName, ctx);
    if (projectIds.length === 0) return false;
    query.project = {$in: projectIds};
    return true;
}

// ── search_contracts ─────────────────────────────────────────────────────────

const SearchContractsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        contractorName: z.string().trim().min(1).optional(),
        status: z.enum(CONTRACT_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        limit: limitArg
    })
    .strip();

const contractParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the contract title or reference."},
        projectName: {type: "string", description: "Only contracts on the project whose name matches this."},
        contractorName: {type: "string", description: "Only contracts with the contractor/consultant whose name matches this."},
        status: {
            type: "string",
            enum: CONTRACT_STATUS_VALUES,
            description: "Contract status: draft, active, suspended, completed, or terminated."
        },
        limit: limitParameter
    },
    required: [] as string[]
};

/** Resolve contractor (Constructor) ids by name, within the company. */
async function resolveContractorIds(name: string, ctx: AssistantToolContext) {
    const contractors = await constructorService.find(
        {...companyScope(ctx), name: regexClause(name)},
        findOptions(ctx),
        undefined,
        "_id",
        undefined,
        25
    );
    return contractors.map((c: any) => c._id).filter(Boolean);
}

async function executeContracts(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchContractsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (!(await applyProjectFilter(query, args.projectName, ctx))) {
        return emptyResult(`No project matching "${args.projectName}" in this company.`);
    }
    if (args.contractorName != null) {
        const ids = await resolveContractorIds(args.contractorName, ctx);
        if (ids.length === 0) {
            return emptyResult(`No contractor matching "${args.contractorName}" in this company.`);
        }
        query.constructorRef = {$in: ids};
    }
    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{title: rx}, {name: rx}, {description: rx}];
    }
    if (args.status) query.status = args.status;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const contracts = await constructionContractService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "constructorRef", select: "name"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name title status contractValue approvedVariationsTotal certifiedClaimsTotal retentionPercent " +
            "startDate endDate project edifice constructorRef currency paymentTerms",
        {startDate: -1},
        limit
    );

    const results = contracts.map((c: any) => {
        const value = toAmount(c.contractValue);
        const variations = toAmount(c.approvedVariationsTotal);
        const certified = toAmount(c.certifiedClaimsTotal);
        return {
            id: c._id?.toString(),
            code: c.name ?? null,
            title: c.title ?? null,
            status: c.status ?? null,
            project: c.project?.name ?? null,
            building: c.edifice?.name ?? null,
            contractor: c.constructorRef?.name ?? null,
            currency: c.currency?.abbreviation || c.currency?.symbol || null,
            contractValue: value,
            approvedVariationsTotal: variations,
            certifiedClaimsTotal: certified,
            // The agreed sum including approved changes, less what has already
            // been certified — i.e. the contractor's remaining entitlement.
            remainingToCertify: roundMoney(value + variations - certified),
            retentionPercent: c.retentionPercent ?? null,
            startDate: c.startDate ?? null,
            endDate: c.endDate ?? null
        };
    });

    return listResult(constructionContractService, query, results, ctx);
}

export const searchContractsTool: AssistantTool = {
    name: "search_contracts",
    description:
        "Search construction contracts with contractors. Filter by free text, " +
        "project, contractor name, or status (draft, active, suspended, completed, " +
        "terminated). Returns each contract's value, approved variation total, " +
        "certified claims to date, remaining amount to certify, retention and dates, " +
        "plus `total` — the true number of matching contracts. Use this for questions " +
        "about contracts, contractor commitments or remaining contract value. For a " +
        "company-wide cost picture use budget_variance.",
    parameters: contractParameters,
    execute: executeContracts
};

// ── search_progress_claims ───────────────────────────────────────────────────

const SearchClaimsArgs = z
    .object({
        projectName: z.string().trim().min(1).optional(),
        status: z.enum(CLAIM_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        periodFrom: z.coerce.date().optional(),
        periodTo: z.coerce.date().optional(),
        limit: limitArg
    })
    .strip();

const claimParameters = {
    type: "object" as const,
    properties: {
        projectName: {type: "string", description: "Only claims on the project whose name matches this."},
        status: {
            type: "string",
            enum: CLAIM_STATUS_VALUES,
            description: "Claim status: draft, submitted, certified, paid, or rejected."
        },
        periodFrom: {type: "string", description: "ISO date; only claims whose period ends on or after this date."},
        periodTo: {type: "string", description: "ISO date; only claims whose period ends on or before this date."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeClaims(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchClaimsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (!(await applyProjectFilter(query, args.projectName, ctx))) {
        return emptyResult(`No project matching "${args.projectName}" in this company.`);
    }
    if (args.status) query.status = args.status;

    const period = dateRange(args.periodFrom, args.periodTo);
    if (period) query.claimPeriodEnd = period;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const claims = await progressClaimService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "constructionContract", select: "name title"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name title status amount certifiedAmount retentionHeld retentionReleased " +
            "claimPeriodStart claimPeriodEnd project constructionContract currency",
        {claimPeriodEnd: -1},
        limit
    );

    const results = claims.map((c: any) => ({
        id: c._id?.toString(),
        code: c.name ?? null,
        title: c.title ?? null,
        status: c.status ?? null,
        project: c.project?.name ?? null,
        contract: c.constructionContract?.title ?? c.constructionContract?.name ?? null,
        currency: c.currency?.abbreviation || c.currency?.symbol || null,
        claimedAmount: toNumber(c.amount),
        certifiedAmount: toNumber(c.certifiedAmount),
        retentionHeld: toNumber(c.retentionHeld),
        retentionReleased: c.retentionReleased ?? false,
        claimPeriodStart: c.claimPeriodStart ?? null,
        claimPeriodEnd: c.claimPeriodEnd ?? null
    }));

    return listResult(progressClaimService, query, results, ctx);
}

export const searchProgressClaimsTool: AssistantTool = {
    name: "search_progress_claims",
    description:
        "Search contractor progress claims (interim payment applications against a " +
        "construction contract). Filter by project, status (draft, submitted, " +
        "certified, paid, rejected) or a claim-period date range. Returns each " +
        "claim's claimed and certified amounts, retention held and period, plus " +
        "`total` — the true number of matching claims. Use this for questions about " +
        "payment applications, certification or retention.",
    parameters: claimParameters,
    execute: executeClaims
};

// ── search_variation_orders ──────────────────────────────────────────────────

const SearchVariationsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        status: z.enum(VARIATION_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        pendingOnly: z.coerce.boolean().optional(),
        limit: limitArg
    })
    .strip();

const variationParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the variation's title or description."},
        projectName: {type: "string", description: "Only variations on the project whose name matches this."},
        status: {
            type: "string",
            enum: VARIATION_STATUS_VALUES,
            description: "Approval state: pending_architect, pending_qs, pending_client, approved, rejected, or cancelled."
        },
        pendingOnly: {
            type: "boolean",
            description: "true = only variations still awaiting a decision (any of the pending_* states)."
        },
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeVariations(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchVariationsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (!(await applyProjectFilter(query, args.projectName, ctx))) {
        return emptyResult(`No project matching "${args.projectName}" in this company.`);
    }
    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{title: rx}, {description: rx}, {name: rx}];
    }
    if (args.pendingOnly === true) {
        query.status = {$in: PENDING_VARIATION_STATUSES};
    } else if (args.status) {
        query.status = args.status;
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const variations = await variationOrderService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "constructionContract", select: "name title"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name title status costImpact timeImpactDays description project edifice " +
            "constructionContract currency billedAt",
        {createdAt: -1},
        limit
    );

    const results = variations.map((v: any) => ({
        id: v._id?.toString(),
        code: v.name ?? null,
        title: v.title ?? null,
        status: v.status ?? null,
        project: v.project?.name ?? null,
        building: v.edifice?.name ?? null,
        contract: v.constructionContract?.title ?? v.constructionContract?.name ?? null,
        costImpact: toNumber(v.costImpact),
        currency: v.currency?.abbreviation || v.currency?.symbol || null,
        timeImpactDays: v.timeImpactDays ?? null,
        billed: v.billedAt != null,
        description: shortText(v.description, 200)
    }));

    return listResult(variationOrderService, query, results, ctx);
}

export const searchVariationOrdersTool: AssistantTool = {
    name: "search_variation_orders",
    description:
        "Search variation orders (approved or proposed changes to a construction " +
        "contract's scope, cost or time). Filter by free text, project, approval " +
        "status, or `pendingOnly` for those still awaiting a decision. Returns each " +
        "variation's cost impact, time impact in days and approval state, plus " +
        "`total` — the true number of matching variations. Use this for questions " +
        "about variations, change orders, scope changes or claims for extra time.",
    parameters: variationParameters,
    execute: executeVariations
};

// ── search_contractor_invoices ───────────────────────────────────────────────

const SearchInvoicesArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        contractorName: z.string().trim().min(1).optional(),
        status: z.enum(INVOICE_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        unpaidOnly: z.coerce.boolean().optional(),
        overdueOnly: z.coerce.boolean().optional(),
        limit: limitArg
    })
    .strip();

const invoiceParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the invoice number or reference."},
        projectName: {type: "string", description: "Only invoices on the project whose name matches this."},
        contractorName: {type: "string", description: "Only invoices from the contractor whose name matches this."},
        status: {
            type: "string",
            enum: INVOICE_STATUS_VALUES,
            description: "Invoice status: received, under_review, approved, paid, rejected, or disputed."
        },
        unpaidOnly: {type: "boolean", description: "true = only invoices not yet paid (received, under_review or approved)."},
        overdueOnly: {type: "boolean", description: "true = only unpaid invoices whose due date has passed."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeInvoices(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchInvoicesArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (!(await applyProjectFilter(query, args.projectName, ctx))) {
        return emptyResult(`No project matching "${args.projectName}" in this company.`);
    }
    if (args.contractorName != null) {
        const ids = await resolveContractorIds(args.contractorName, ctx);
        if (ids.length === 0) {
            return emptyResult(`No contractor matching "${args.contractorName}" in this company.`);
        }
        query.constructorRef = {$in: ids};
    }
    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{invoiceNumber: rx}, {name: rx}, {qrBillReference: rx}];
    }

    if (args.overdueOnly === true) {
        query.status = {$in: UNPAID_INVOICE_STATUSES};
        query.dueDate = {$lt: new Date()};
    } else if (args.unpaidOnly === true) {
        query.status = {$in: UNPAID_INVOICE_STATUSES};
    } else if (args.status) {
        query.status = args.status;
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const invoices = await contractorInvoiceService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "constructorRef", select: "name"},
            {path: "constructionContract", select: "name title"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name invoiceNumber status invoiceDate dueDate netAmount vatAmount grossAmount retentionHeld " +
            "project constructorRef constructionContract currency source",
        {dueDate: 1},
        limit
    );

    const results = invoices.map((i: any) => {
        const overdue = daysOverdue(i.dueDate);
        const unpaid = UNPAID_INVOICE_STATUSES.includes(i.status);
        return {
            id: i._id?.toString(),
            code: i.name ?? null,
            invoiceNumber: i.invoiceNumber ?? null,
            status: i.status ?? null,
            project: i.project?.name ?? null,
            contractor: i.constructorRef?.name ?? null,
            contract: i.constructionContract?.title ?? i.constructionContract?.name ?? null,
            currency: i.currency?.abbreviation || i.currency?.symbol || null,
            netAmount: toNumber(i.netAmount),
            vatAmount: toNumber(i.vatAmount),
            grossAmount: toNumber(i.grossAmount),
            retentionHeld: toNumber(i.retentionHeld),
            invoiceDate: i.invoiceDate ?? null,
            dueDate: i.dueDate ?? null,
            daysOverdue: unpaid && overdue != null && overdue > 0 ? overdue : 0
        };
    });

    return listResult(contractorInvoiceService, query, results, ctx);
}

export const searchContractorInvoicesTool: AssistantTool = {
    name: "search_contractor_invoices",
    description:
        "Search invoices received from contractors and consultants (accounts " +
        "payable). Filter by invoice number, project, contractor, status (received, " +
        "under_review, approved, paid, rejected, disputed), `unpaidOnly`, or " +
        "`overdueOnly`. Returns each invoice's net/VAT/gross amounts, retention, " +
        "dates and days overdue, plus `total` — the true number of matching " +
        "invoices. Use this for questions about what the company owes contractors, " +
        "unpaid or overdue supplier invoices.",
    parameters: invoiceParameters,
    execute: executeInvoices
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerContractsAndClaimsAssistantTools(): void {
    registerAssistantTool(searchContractsTool);
    registerAssistantTool(searchProgressClaimsTool);
    registerAssistantTool(searchVariationOrdersTool);
    registerAssistantTool(searchContractorInvoicesTool);
}
