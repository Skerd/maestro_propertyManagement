/**
 * `search_reservations` + `search_leases` — AI-assistant tools for the two
 * occupancy records attached to real-estate units.
 *
 * Lets the assistant answer "which reservations expire this month?", "show
 * unpaid reservations for A-102", "list active leases", "which leases end before
 * September?". Both query real records and both are hard-scoped to the calling
 * human's company; soft-deleted rows are excluded. Registered into the core tool
 * registry at startup; the brain (core) never imports this module directly.
 *
 * SECURITY: all arguments are untrusted LLM output. They are re-validated with
 * Zod and every query carries `company: ObjectId(ctx.companyId)` — the model
 * cannot widen scope or reach another company's records, including via a
 * `unitNumber` (the unit is itself resolved within the company scope first).
 *
 * @module reservationsAndLeasesTool
 */

import {Decimal128, ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {leaseService} from "@propertyManagement/database/schemas/lease/lease.service";
import {ReservationStatus} from "@propertyManagement/database/schemas/reservation/reservation";
import {LeaseStatus} from "@propertyManagement/database/schemas/lease/lease";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;

const RESERVATION_STATUS_VALUES = Object.values(ReservationStatus) as string[];
const LEASE_STATUS_VALUES = Object.values(LeaseStatus) as string[];

/** Parse a Decimal128 amount into a plain number for the JSON result. */
function amountToNumber(amount: unknown): number | null {
    if (amount == null) return null;
    const n = parseFloat(amount.toString());
    return Number.isFinite(n) ? n : null;
}

/** Best display name for a populated User (client/tenant), null-safe. */
function userDisplayName(user: any): string | null {
    if (!user) return null;
    const full = [user.name, user.surname].filter(Boolean).join(" ").trim();
    return full || user.username || null;
}

/**
 * Resolve a unit number to its id within the company. Returns the id, or `null`
 * if no such unit exists in this company (caller then returns an empty result).
 */
async function resolveUnitId(unitNumber: string, ctx: AssistantToolContext): Promise<ObjectId | null> {
    const unit: any = await unitService.findOne(
        {company: new ObjectId(ctx.companyId), unitNumber},
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        undefined,
        "_id"
    );
    return unit?._id ?? null;
}

// ---------------------------------------------------------------------------
// search_reservations
// ---------------------------------------------------------------------------

const SearchReservationsArgs = z
    .object({
        unitNumber: z.string().trim().min(1).optional(),
        status: z.enum(RESERVATION_STATUS_VALUES as [string, ...string[]]).optional(),
        paid: z.coerce.boolean().optional(),
        expiringBefore: z.coerce.date().optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const reservationParameters = {
    type: "object" as const,
    properties: {
        unitNumber: {type: "string", description: "Only reservations for this unit number (e.g. \"A-102\")."},
        status: {
            type: "string",
            enum: RESERVATION_STATUS_VALUES,
            description: "Reservation status: active, expired, cancelled, or converted (to a sale)."
        },
        paid: {type: "boolean", description: "Only reservations whose deposit is paid (true) or unpaid (false)."},
        expiringBefore: {
            type: "string",
            description: "ISO date; only reservations expiring on or before this date (find soon-to-expire ones)."
        },
        limit: {
            type: "integer",
            description: `Maximum number of results (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

async function executeReservations(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchReservationsArgs.parse(rawArgs ?? {});

    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) {
            return {count: 0, capped: false, results: [], note: `No unit "${args.unitNumber}" in this company.`};
        }
        query.unit = unitId;
    }
    if (args.status) query.status = args.status;
    if (args.paid != null) query.paid = args.paid;
    if (args.expiringBefore != null) query.expirationDate = {$lte: args.expiringBefore};

    const limit = args.limit ?? DEFAULT_RESULTS;

    const reservations = await reservationService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "unit", select: "unitNumber name"},
            {path: "client", select: "name surname username"},
            {path: "depositCurrency", select: "symbol abbreviation name"}
        ],
        "name unit client status reservationDate expirationDate depositAmount depositCurrency paid",
        {expirationDate: 1},
        limit
    );

    const results = reservations.map((r: any) => ({
        id: r._id?.toString(),
        code: r.name ?? null,
        unitNumber: r.unit?.unitNumber ?? null,
        client: userDisplayName(r.client),
        status: r.status ?? null,
        reservationDate: r.reservationDate ?? null,
        expirationDate: r.expirationDate ?? null,
        deposit: amountToNumber(r.depositAmount),
        currency: r.depositCurrency?.abbreviation || r.depositCurrency?.symbol || null,
        paid: r.paid ?? false
    }));

    return {count: results.length, capped: results.length >= limit, results};
}

export const searchReservationsTool: AssistantTool = {
    name: "search_reservations",
    description:
        "Search the company's unit reservations by unit number, status (active, " +
        "expired, cancelled, converted), whether the deposit is paid, or an expiry " +
        "cut-off date. Returns each reservation with its unit, client, status, dates " +
        "and deposit. Use this for questions about reservations/holds on units.",
    parameters: reservationParameters,
    execute: executeReservations
};

// ---------------------------------------------------------------------------
// search_leases
// ---------------------------------------------------------------------------

const SearchLeasesArgs = z
    .object({
        unitNumber: z.string().trim().min(1).optional(),
        status: z.enum(LEASE_STATUS_VALUES as [string, ...string[]]).optional(),
        endingBefore: z.coerce.date().optional(),
        minRent: z.coerce.number().nonnegative().optional(),
        maxRent: z.coerce.number().nonnegative().optional(),
        limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
    })
    .strip();

const leaseParameters = {
    type: "object" as const,
    properties: {
        unitNumber: {type: "string", description: "Only leases for this unit number (e.g. \"A-102\")."},
        status: {
            type: "string",
            enum: LEASE_STATUS_VALUES,
            description: "Lease status: active, expired, or terminated."
        },
        endingBefore: {
            type: "string",
            description: "ISO date; only leases ending on or before this date (find leases ending soon)."
        },
        minRent: {type: "number", description: "Minimum monthly rent (in the lease's own currency)."},
        maxRent: {type: "number", description: "Maximum monthly rent (in the lease's own currency)."},
        limit: {
            type: "integer",
            description: `Maximum number of results (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

async function executeLeases(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchLeasesArgs.parse(rawArgs ?? {});

    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    if (args.unitNumber != null) {
        const unitId = await resolveUnitId(args.unitNumber, ctx);
        if (!unitId) {
            return {count: 0, capped: false, results: [], note: `No unit "${args.unitNumber}" in this company.`};
        }
        query.unit = unitId;
    }
    if (args.status) query.status = args.status;
    if (args.endingBefore != null) query.endDate = {$lte: args.endingBefore};

    if (args.minRent != null || args.maxRent != null) {
        const rent: Record<string, Decimal128> = {};
        if (args.minRent != null) rent.$gte = Decimal128.fromString(String(args.minRent));
        if (args.maxRent != null) rent.$lte = Decimal128.fromString(String(args.maxRent));
        query.monthlyRent = rent;
    }

    const limit = args.limit ?? DEFAULT_RESULTS;

    const leases = await leaseService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "unit", select: "unitNumber name"},
            {path: "tenant", select: "name surname username"},
            {path: "rentCurrency", select: "symbol abbreviation name"}
        ],
        "name unit tenant status startDate endDate monthlyRent rentCurrency depositAmount depositPaid",
        {endDate: 1},
        limit
    );

    const results = leases.map((l: any) => ({
        id: l._id?.toString(),
        code: l.name ?? null,
        unitNumber: l.unit?.unitNumber ?? null,
        tenant: userDisplayName(l.tenant),
        status: l.status ?? null,
        startDate: l.startDate ?? null,
        endDate: l.endDate ?? null,
        monthlyRent: amountToNumber(l.monthlyRent),
        currency: l.rentCurrency?.abbreviation || l.rentCurrency?.symbol || null,
        deposit: amountToNumber(l.depositAmount),
        depositPaid: l.depositPaid ?? false
    }));

    return {count: results.length, capped: results.length >= limit, results};
}

export const searchLeasesTool: AssistantTool = {
    name: "search_leases",
    description:
        "Search the company's leases (rental contracts) by unit number, status " +
        "(active, expired, terminated), an end-date cut-off, or monthly-rent range. " +
        "Returns each lease with its unit, tenant, status, start/end dates and rent. " +
        "Use this for questions about tenancies, rentals, or leases ending soon.",
    parameters: leaseParameters,
    execute: executeLeases
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerReservationsAndLeasesAssistantTools(): void {
    registerAssistantTool(searchReservationsTool);
    registerAssistantTool(searchLeasesTool);
}
