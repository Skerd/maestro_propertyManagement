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
import {projectDocumentService} from "@propertyManagement/database/schemas/projectDocument/projectDocument.service";
import {constructorService} from "@propertyManagement/database/schemas/constructor/constructor.service";
import {warrantyService} from "@propertyManagement/database/schemas/warranty/warranty.service";
import {
    projectDocumentDisciplineValues,
    projectDocumentStatusValues,
    projectDocumentTypeValues
} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/projectDocument.schema-def";
import {constructorPartyTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.schema-def";
import {warrantyStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/warranty.schema-def";
import {
    DEFAULT_RESULTS,
    companyScope,
    dateRange,
    emptyResult,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    regexClause,
    resolveEdificeIds,
    resolveProjectIds,
    resolveUnitId,
    shortText,
    toNumber
} from "./assistantToolHelpers";

const DOCUMENT_STATUS_VALUES = [...projectDocumentStatusValues];
const DOCUMENT_TYPE_VALUES = [...projectDocumentTypeValues];
const DOCUMENT_DISCIPLINE_VALUES = [...projectDocumentDisciplineValues];
const PARTY_TYPE_VALUES = [...constructorPartyTypeValues];
const WARRANTY_STATUS_VALUES = [...warrantyStatusValues];

// ── search_documents ─────────────────────────────────────────────────────────

const SearchDocumentsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        buildingName: z.string().trim().min(1).optional(),
        status: z.enum(DOCUMENT_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        documentType: z.enum(DOCUMENT_TYPE_VALUES as unknown as [string, ...string[]]).optional(),
        discipline: z.enum(DOCUMENT_DISCIPLINE_VALUES as unknown as [string, ...string[]]).optional(),
        requiredDeliverablesOnly: z.coerce.boolean().optional(),
        asBuiltOnly: z.coerce.boolean().optional(),
        limit: limitArg
    })
    .strip();

const documentParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the document title or document number."},
        projectName: {type: "string", description: "Only documents on the project whose name matches this."},
        buildingName: {type: "string", description: "Only documents on the building (edifice) whose name matches this."},
        status: {
            type: "string",
            enum: DOCUMENT_STATUS_VALUES,
            description: "Document status: draft, for_review, approved, rejected, or superseded."
        },
        documentType: {
            type: "string",
            enum: DOCUMENT_TYPE_VALUES,
            description: "Document type: drawing, specification, calculation, report, as_built, om_manual, or other."
        },
        discipline: {
            type: "string",
            enum: DOCUMENT_DISCIPLINE_VALUES,
            description: "Design discipline: architectural, structural, mep, civil, fire, landscape, or other."
        },
        requiredDeliverablesOnly: {
            type: "boolean",
            description: "true = only documents flagged as required design-stage deliverables (use to find gaps)."
        },
        asBuiltOnly: {type: "boolean", description: "true = only as-built records."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeDocuments(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchDocumentsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (args.projectName != null) {
        const projectIds = await resolveProjectIds(args.projectName, ctx);
        if (projectIds.length === 0) {
            return emptyResult(`No project matching "${args.projectName}" in this company.`);
        }
        query.project = {$in: projectIds};
    }
    if (args.buildingName != null) {
        const edificeIds = await resolveEdificeIds(args.buildingName, ctx);
        if (edificeIds.length === 0) {
            return emptyResult(`No building matching "${args.buildingName}" in this company.`);
        }
        query.edifice = {$in: edificeIds};
    }

    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{title: rx}, {documentNumber: rx}, {name: rx}];
    }
    if (args.status) query.status = args.status;
    if (args.documentType) query.documentType = args.documentType;
    if (args.discipline) query.discipline = args.discipline;
    if (args.requiredDeliverablesOnly === true) query.isRequiredDeliverable = true;
    if (args.asBuiltOnly === true) query.isAsBuilt = true;

    const limit = args.limit ?? DEFAULT_RESULTS;

    // Metadata only: the media array is deliberately not selected, so the
    // assistant can tell the user a document exists without handing out files.
    const documents = await projectDocumentService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "designStage", select: "name title"}
        ],
        "name title documentNumber documentType discipline status revision revisionDate " +
            "isAsBuilt isRequiredDeliverable project edifice designStage description",
        {revisionDate: -1},
        limit
    );

    const results = documents.map((d: any) => ({
        id: d._id?.toString(),
        code: d.name ?? null,
        title: d.title ?? null,
        documentNumber: d.documentNumber ?? null,
        documentType: d.documentType ?? null,
        discipline: d.discipline ?? null,
        status: d.status ?? null,
        revision: d.revision ?? null,
        revisionDate: d.revisionDate ?? null,
        isAsBuilt: d.isAsBuilt ?? false,
        isRequiredDeliverable: d.isRequiredDeliverable ?? false,
        project: d.project?.name ?? null,
        building: d.edifice?.name ?? null,
        designStage: d.designStage?.title ?? d.designStage?.name ?? null,
        description: shortText(d.description, 200)
    }));

    return listResult(projectDocumentService, query, results, ctx);
}

export const searchDocumentsTool: AssistantTool = {
    name: "search_documents",
    description:
        "Search the project document register (drawings, specifications, reports, " +
        "as-builts, O&M manuals). Filter by free text, project, building, status, " +
        "document type, design discipline, required-deliverable flag or as-built " +
        "flag. Returns document metadata — title, number, revision, status, design " +
        "stage — plus `total`, the true number of matching documents. It does NOT " +
        "return file contents or download links. Use this for questions about " +
        "drawings, document control, revisions or missing deliverables.",
    parameters: documentParameters,
    execute: executeDocuments
};

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

// ── search_warranties ────────────────────────────────────────────────────────

const SearchWarrantiesArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        buildingName: z.string().trim().min(1).optional(),
        unitNumber: z.string().trim().min(1).optional(),
        status: z.enum(WARRANTY_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        expiringFrom: z.coerce.date().optional(),
        expiringBefore: z.coerce.date().optional(),
        limit: limitArg
    })
    .strip();

const warrantyParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the warranty title or description."},
        projectName: {type: "string", description: "Only warranties on the project whose name matches this."},
        buildingName: {type: "string", description: "Only warranties on the building (edifice) whose name matches this."},
        unitNumber: {type: "string", description: "Only warranties on this exact unit number."},
        status: {
            type: "string",
            enum: WARRANTY_STATUS_VALUES,
            description: "Warranty status: active, expired, or void."
        },
        expiringFrom: {type: "string", description: "ISO date; only warranties ending on or after this date."},
        expiringBefore: {type: "string", description: "ISO date; only warranties ending on or before this date."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeWarranties(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchWarrantiesArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) return emptyResult(`No unit "${args.unitNumber}" in this company.`);
        query.unit = unitId;
    }
    if (args.projectName != null) {
        const projectIds = await resolveProjectIds(args.projectName, ctx);
        if (projectIds.length === 0) {
            return emptyResult(`No project matching "${args.projectName}" in this company.`);
        }
        query.project = {$in: projectIds};
    }
    if (args.buildingName != null) {
        const edificeIds = await resolveEdificeIds(args.buildingName, ctx);
        if (edificeIds.length === 0) {
            return emptyResult(`No building matching "${args.buildingName}" in this company.`);
        }
        query.edifice = {$in: edificeIds};
    }

    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{title: rx}, {description: rx}, {name: rx}];
    }
    if (args.status) query.status = args.status;

    const expiry = dateRange(args.expiringFrom, args.expiringBefore);
    if (expiry) query.endDate = expiry;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const warranties = await warrantyService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "unit", select: "unitNumber name"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name title status startDate endDate retentionAmount retentionReleaseDate " +
            "project edifice unit currency description",
        {endDate: 1},
        limit
    );

    const results = warranties.map((w: any) => ({
        id: w._id?.toString(),
        code: w.name ?? null,
        title: w.title ?? null,
        status: w.status ?? null,
        project: w.project?.name ?? null,
        building: w.edifice?.name ?? null,
        unitNumber: w.unit?.unitNumber ?? w.unit?.name ?? null,
        startDate: w.startDate ?? null,
        endDate: w.endDate ?? null,
        retentionAmount: toNumber(w.retentionAmount),
        currency: w.currency?.abbreviation || w.currency?.symbol || null,
        retentionReleaseDate: w.retentionReleaseDate ?? null,
        description: shortText(w.description, 200)
    }));

    return listResult(warrantyService, query, results, ctx);
}

export const searchWarrantiesTool: AssistantTool = {
    name: "search_warranties",
    description:
        "Search warranties and defects-liability periods held on delivered work. " +
        "Filter by free text, project, building, unit, status (active, expired, " +
        "void), or an end-date range. Returns each warranty's cover period, " +
        "retention amount and release date, plus `total` — the true number of " +
        "matches. Use this for questions about warranties, guarantees, DLP expiry or " +
        "retention release.",
    parameters: warrantyParameters,
    execute: executeWarranties
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerDocumentsAndPartiesAssistantTools(): void {
    registerAssistantTool(searchDocumentsTool);
    registerAssistantTool(searchContractorsTool);
    registerAssistantTool(searchWarrantiesTool);
}
