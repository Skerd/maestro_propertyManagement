/**
 * `search_schedule_tasks` — AI-assistant tool for the construction programme at
 * task level.
 *
 * Answers "what's running late on site?", "what's scheduled to finish this
 * month?", "which tasks are assigned to me?", "how far along is the fit-out?".
 * Complements `milestone_risk`, which reports the coarser milestone layer.
 *
 * SECURITY: arguments are untrusted LLM output — re-validated with Zod, free
 * text regex-escaped, and every query hard-scoped to `ctx.companyId`. The
 * "assigned to me" filter is built from the trusted context, never from an id
 * the model supplied.
 *
 * @module searchScheduleTasksTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {scheduleTaskService} from "@propertyManagement/database/schemas/scheduleTask/scheduleTask.service";
import {scheduleTaskStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/scheduleTask.schema-def";
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
    userDisplayName
} from "./assistantToolHelpers";

const TASK_STATUS_VALUES = [...scheduleTaskStatusValues];

/** Statuses that mean the task is still live and can therefore slip. */
const ACTIVE_TASK_STATUSES = ["planned", "in_progress"];

const SearchScheduleTasksArgs = z
    .object({
        search: z.string().trim().min(1).optional(),
        projectName: z.string().trim().min(1).optional(),
        buildingName: z.string().trim().min(1).optional(),
        status: z.enum(TASK_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
        lateOnly: z.coerce.boolean().optional(),
        assignedToMe: z.coerce.boolean().optional(),
        endsFrom: z.coerce.date().optional(),
        endsTo: z.coerce.date().optional(),
        limit: limitArg
    })
    .strip();

const parameters = {
    type: "object" as const,
    properties: {
        search: {type: "string", description: "Free text matched against the task's title or description."},
        projectName: {type: "string", description: "Only tasks on the project whose name matches this."},
        buildingName: {type: "string", description: "Only tasks on the building (edifice) whose name matches this."},
        status: {
            type: "string",
            enum: TASK_STATUS_VALUES,
            description: "Task status: planned, in_progress, completed, delayed, or cancelled."
        },
        lateOnly: {
            type: "boolean",
            description: "true = tasks marked delayed, plus planned/in-progress tasks whose planned end has already passed. Prefer this for \"what is running late\"."
        },
        assignedToMe: {type: "boolean", description: "true when the user asks about tasks assigned to THEM."},
        endsFrom: {type: "string", description: "ISO date; only tasks whose planned end is on or after this date."},
        endsTo: {type: "string", description: "ISO date; only tasks whose planned end is on or before this date."},
        limit: limitParameter
    },
    required: [] as string[]
};

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchScheduleTasksArgs.parse(rawArgs ?? {});
    const now = new Date();

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
        query.$or = [{title: rx}, {description: rx}, {name: rx}];
    }
    if (args.assignedToMe === true) query.assignee = new ObjectId(ctx.userId);

    if (args.lateOnly === true) {
        // "Late" is not just the delayed flag: a task nobody has updated is still
        // late if its planned end has passed while it is planned/in-progress.
        query.$and = [
            {
                $or: [
                    {status: "delayed"},
                    {status: {$in: ACTIVE_TASK_STATUSES}, plannedEnd: {$lt: now}}
                ]
            }
        ];
    } else {
        if (args.status) query.status = args.status;
        const ends = dateRange(args.endsFrom, args.endsTo);
        if (ends) query.plannedEnd = ends;
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const tasks = await scheduleTaskService.find(
        query,
        findOptions(ctx),
        [
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "milestone", select: "name title"},
            {path: "assignee", select: "name surname username"}
        ],
        "name title status plannedStart plannedEnd actualStart actualEnd percentComplete " +
            "project edifice milestone assignee description",
        {plannedEnd: 1},
        limit
    );

    const results = tasks.map((t: any) => {
        const overdue = daysOverdue(t.plannedEnd);
        const live = ACTIVE_TASK_STATUSES.includes(t.status) || t.status === "delayed";
        return {
            id: t._id?.toString(),
            code: t.name ?? null,
            title: t.title ?? null,
            status: t.status ?? null,
            project: t.project?.name ?? null,
            building: t.edifice?.name ?? null,
            milestone: t.milestone?.title ?? t.milestone?.name ?? null,
            assignee: userDisplayName(t.assignee),
            plannedStart: t.plannedStart ?? null,
            plannedEnd: t.plannedEnd ?? null,
            actualStart: t.actualStart ?? null,
            actualEnd: t.actualEnd ?? null,
            percentComplete: t.percentComplete ?? null,
            daysLate: live && overdue != null && overdue > 0 ? overdue : 0
        };
    });

    return listResult(scheduleTaskService, query, results, ctx);
}

export const searchScheduleTasksTool: AssistantTool = {
    name: "search_schedule_tasks",
    description:
        "Search construction programme tasks (the detailed schedule beneath " +
        "milestones). Filter by free text, project, building, status (planned, " +
        "in_progress, completed, delayed, cancelled), a planned-end date range, " +
        "tasks assigned to the asking user, or `lateOnly` for slipping work. Returns " +
        "each task with its milestone, dates, percent complete and days late, plus " +
        "`total` — the true number of matching tasks. Use this for questions about " +
        "the programme, site progress, or what is running late. For the higher-level " +
        "milestone view use milestone_risk.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerScheduleTasksAssistantTools(): void {
    registerAssistantTool(searchScheduleTasksTool);
}
