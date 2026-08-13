/**
 * `search_work_orders` + `search_safety_incidents` — AI-assistant tools for
 * facilities maintenance and site safety.
 *
 * Answers "what maintenance is outstanding?", "which work orders are overdue?",
 * "what did we spend on corrective maintenance?", "were there any safety
 * incidents this month?", "show open critical incidents".
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, free
 * text regex-escaped, and every query hard-scoped to `ctx.companyId`.
 *
 * @module maintenanceAndSafetyTools
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {maintenanceWorkOrderService} from "@propertyManagement/database/schemas/maintenanceWorkOrder/maintenanceWorkOrder.service";
import {safetyIncidentService} from "@propertyManagement/database/schemas/safetyIncident/safetyIncident.service";
import {
    maintenanceWorkOrderStatusValues,
    maintenanceWorkOrderTypeValues
} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/maintenanceWorkOrder.schema-def";
import {safetyIncidentStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/safetyIncident.schema-def";
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
    resolveEdificeIds,
    resolveProjectIds,
    shortText,
    toNumber,
    userDisplayName
} from "./assistantToolHelpers";

const WORK_ORDER_STATUS_VALUES = [...maintenanceWorkOrderStatusValues];
const WORK_ORDER_TYPE_VALUES = [...maintenanceWorkOrderTypeValues];
const INCIDENT_STATUS_VALUES = [...safetyIncidentStatusValues];
const INCIDENT_SEVERITY_VALUES = ["low", "medium", "high", "critical"];

/** Work-order statuses that still represent outstanding work. */
const OPEN_WORK_ORDER_STATUSES = ["open", "assigned", "in_progress"];

// ── search_work_orders ───────────────────────────────────────────────────────

const SearchWorkOrdersArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        buildingName: z.string().trim().min(1).optional(),
        status: z.enum(WORK_ORDER_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        type: z.enum(WORK_ORDER_TYPE_VALUES as unknown as [string, ...string[]]).optional(),
        openOnly: z.coerce.boolean().optional(),
        overdueOnly: z.coerce.boolean().optional(),
        dueBefore: z.coerce.date().optional(),
        limit: limitArg
    })
    .strip();

const workOrderParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the work order's title or notes."},
        buildingName: {type: "string", description: "Only work orders for the building (edifice) whose name matches this."},
        status: {
            type: "string",
            enum: WORK_ORDER_STATUS_VALUES,
            description: "Work-order status: open, assigned, in_progress, done, verified, closed, or cancelled."
        },
        type: {
            type: "string",
            enum: WORK_ORDER_TYPE_VALUES,
            description: "Maintenance type: preventive (planned), corrective (a fix), or renovation."
        },
        openOnly: {type: "boolean", description: "true = only outstanding work (open, assigned or in_progress)."},
        overdueOnly: {type: "boolean", description: "true = only outstanding work whose due date has passed."},
        dueBefore: {type: "string", description: "ISO date; only work orders due on or before this date."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeWorkOrders(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchWorkOrdersArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    if (args.buildingName != null) {
        const edificeIds = await resolveEdificeIds(args.buildingName, ctx);
        if (edificeIds.length === 0) {
            return emptyResult(`No building matching "${args.buildingName}" in this company.`);
        }
        query.edifice = {$in: edificeIds};
    }

    if (args.search != null) {
        const rx = regexClause(args.search);
        query.$or = [{title: rx}, {notes: rx}, {name: rx}];
    }
    if (args.type) query.type = args.type;

    if (args.overdueOnly === true) {
        query.status = {$in: OPEN_WORK_ORDER_STATUSES};
        query.dueDate = {$lt: new Date()};
    } else {
        if (args.openOnly === true) {
            query.status = {$in: OPEN_WORK_ORDER_STATUSES};
        } else if (args.status) {
            query.status = args.status;
        }
        if (args.dueBefore != null) query.dueDate = {$lte: args.dueBefore};
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const workOrders = await maintenanceWorkOrderService.find(
        query,
        findOptions(ctx),
        [
            {path: "edifice", select: "name"},
            {path: "asset", select: "name title"},
            {path: "assignee", select: "name"},
            {path: "currency", select: "symbol abbreviation name"}
        ],
        "name title type status edifice asset assignee dueDate costEstimate actualCost currency notes linkedSnag",
        {dueDate: 1},
        limit
    );

    const results = workOrders.map((w: any) => {
        const overdue = daysOverdue(w.dueDate);
        const outstanding = OPEN_WORK_ORDER_STATUSES.includes(w.status);
        return {
            id: w._id?.toString(),
            code: w.name ?? null,
            title: w.title ?? null,
            type: w.type ?? null,
            status: w.status ?? null,
            building: w.edifice?.name ?? null,
            asset: w.asset?.name ?? w.asset?.title ?? null,
            // The assignee of a work order is a Constructor (a contractor company),
            // not a platform user — hence the plain name rather than a display name.
            assignee: w.assignee?.name ?? null,
            dueDate: w.dueDate ?? null,
            daysOverdue: outstanding && overdue != null && overdue > 0 ? overdue : 0,
            costEstimate: toNumber(w.costEstimate),
            actualCost: toNumber(w.actualCost),
            currency: w.currency?.abbreviation || w.currency?.symbol || null,
            hasLinkedSnag: w.linkedSnag != null,
            notes: shortText(w.notes, 200)
        };
    });

    return listResult(maintenanceWorkOrderService, query, results, ctx);
}

export const searchWorkOrdersTool: AssistantTool = {
    name: "search_work_orders",
    description:
        "Search maintenance work orders on buildings and assets. Filter by free " +
        "text, building, status (open, assigned, in_progress, done, verified, " +
        "closed, cancelled), type (preventive, corrective, renovation), `openOnly`, " +
        "`overdueOnly`, or a due-date cut-off. Returns each work order with its " +
        "building, asset, assigned contractor, due date, days overdue and cost, plus " +
        "`total` — the true number of matching work orders. Use this for questions " +
        "about maintenance, repairs, planned servicing or facilities work.",
    parameters: workOrderParameters,
    execute: executeWorkOrders
};

// ── search_safety_incidents ──────────────────────────────────────────────────

const SearchSafetyIncidentsArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        buildingName: z.string().trim().min(1).optional(),
        status: z.enum(INCIDENT_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        severity: z.enum(INCIDENT_SEVERITY_VALUES as [string, ...string[]]).optional(),
        occurredFrom: z.coerce.date().optional(),
        occurredTo: z.coerce.date().optional(),
        limit: limitArg
    })
    .strip();

const incidentParameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the incident's title, description or location."},
        projectName: {type: "string", description: "Only incidents on the project whose name matches this."},
        buildingName: {type: "string", description: "Only incidents on the building (edifice) whose name matches this."},
        status: {
            type: "string",
            enum: INCIDENT_STATUS_VALUES,
            description: "Incident status: reported, investigating, or closed."
        },
        severity: {
            type: "string",
            enum: INCIDENT_SEVERITY_VALUES,
            description: "Incident severity: low, medium, high, or critical."
        },
        occurredFrom: {type: "string", description: "ISO date; only incidents on or after this date."},
        occurredTo: {type: "string", description: "ISO date; only incidents on or before this date."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function executeSafetyIncidents(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchSafetyIncidentsArgs.parse(rawArgs ?? {});

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
        query.$or = [{title: rx}, {description: rx}, {location: rx}, {name: rx}];
    }
    if (args.status) query.status = args.status;
    if (args.severity) query.severity = args.severity;

    const occurred = dateRange(args.occurredFrom, args.occurredTo);
    if (occurred) query.incidentDate = occurred;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const incidents = await safetyIncidentService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "reportedBy", select: "name surname username"}
        ],
        "name title severity status location incidentDate description correctiveActions " +
            "personsInvolved project edifice reportedBy",
        {incidentDate: -1},
        limit
    );

    const results = incidents.map((i: any) => ({
        id: i._id?.toString(),
        code: i.name ?? null,
        title: i.title ?? null,
        severity: i.severity ?? null,
        status: i.status ?? null,
        incidentDate: i.incidentDate ?? null,
        location: i.location ?? null,
        project: i.project?.name ?? null,
        building: i.edifice?.name ?? null,
        reportedBy: userDisplayName(i.reportedBy),
        description: shortText(i.description, 250),
        correctiveActions: shortText(i.correctiveActions, 250),
        personsInvolved: shortText(i.personsInvolved, 150)
    }));

    return listResult(safetyIncidentService, query, results, ctx);
}

export const searchSafetyIncidentsTool: AssistantTool = {
    name: "search_safety_incidents",
    description:
        "Search site health-and-safety incidents. Filter by free text, project, " +
        "building, status (reported, investigating, closed), severity (low…critical), " +
        "or an incident-date range. Returns each incident with its severity, status, " +
        "location, description and corrective actions, plus `total` — the true number " +
        "of matching incidents. Use this for questions about safety, accidents, " +
        "near-misses or HSE reporting.",
    parameters: incidentParameters,
    execute: executeSafetyIncidents
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerMaintenanceAndSafetyAssistantTools(): void {
    registerAssistantTool(searchWorkOrdersTool);
    registerAssistantTool(searchSafetyIncidentsTool);
}
