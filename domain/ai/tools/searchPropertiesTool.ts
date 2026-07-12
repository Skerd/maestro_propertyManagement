/**
 * `search_properties` — AI-assistant tool for finding real-estate units.
 *
 * Lets the assistant answer questions like "find properties between 150k and
 * 200k euro" by querying real units. Registered into the core tool registry at
 * startup; the brain (core) never imports this module directly.
 *
 * SECURITY: the arguments come from the LLM and are untrusted. They are
 * re-validated with Zod here, and every query is hard-scoped to the calling
 * human's company ({@link AssistantToolContext.companyId}) with soft-deleted
 * units excluded. The model cannot widen this scope.
 *
 * @module searchPropertiesTool
 */

import {Decimal128, ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {
    UnitStatus,
    UNIT_CONSTRUCTION_STATUS_VALUES
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

/** Hard cap on rows returned to the model, to protect its context window. */
const MAX_RESULTS = 25;
const DEFAULT_RESULTS = 10;

const STATUS_VALUES = Object.values(UnitStatus) as string[];
const CONSTRUCTION_STATUS_VALUES = [...UNIT_CONSTRUCTION_STATUS_VALUES];

/**
 * Zod schema re-validating the model's arguments. All fields optional; numbers
 * are coerced so string/number both parse. Unknown keys are stripped.
 */
const SearchPropertiesArgs = z.object({
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minArea: z.coerce.number().nonnegative().optional(),
    maxArea: z.coerce.number().nonnegative().optional(),
    minRooms: z.coerce.number().int().nonnegative().optional(),
    status: z.enum(STATUS_VALUES as [string, ...string[]]).optional(),
    constructionStatus: z.enum(CONSTRUCTION_STATUS_VALUES as [string, ...string[]]).optional(),
    seaView: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(MAX_RESULTS).optional()
}).strip();

/** JSON Schema shown to the model. Mirrors {@link SearchPropertiesArgs}. */
const parameters = {
    type: "object" as const,
    properties: {
        minPrice: {type: "number", description: "Minimum unit price (in the unit's own currency)."},
        maxPrice: {type: "number", description: "Maximum unit price (in the unit's own currency)."},
        minArea: {type: "number", description: "Minimum area in square meters."},
        maxArea: {type: "number", description: "Maximum area in square meters."},
        minRooms: {type: "integer", description: "Minimum number of rooms/bedrooms."},
        status: {
            type: "string",
            enum: STATUS_VALUES,
            description: "Availability status of the unit."
        },
        constructionStatus: {
            type: "string",
            enum: CONSTRUCTION_STATUS_VALUES,
            description: "Construction stage of the unit."
        },
        seaView: {type: "boolean", description: "Only units that have a sea view."},
        limit: {
            type: "integer",
            description: `Maximum number of results to return (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS}).`
        }
    },
    required: [] as string[]
};

/** Parse a Decimal128 price into a plain number for the JSON result. */
function priceToNumber(price: unknown): number | null {
    if (price == null) return null;
    const n = parseFloat(price.toString());
    return Number.isFinite(n) ? n : null;
}

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchPropertiesArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    if (args.minPrice != null || args.maxPrice != null) {
        const price: Record<string, Decimal128> = {};
        if (args.minPrice != null) price.$gte = Decimal128.fromString(String(args.minPrice));
        if (args.maxPrice != null) price.$lte = Decimal128.fromString(String(args.maxPrice));
        query.price = price;
    }

    if (args.minArea != null || args.maxArea != null) {
        const area: Record<string, number> = {};
        if (args.minArea != null) area.$gte = args.minArea;
        if (args.maxArea != null) area.$lte = args.maxArea;
        query.area = area;
    }

    if (args.minRooms != null) query.numberOfRooms = {$gte: args.minRooms};
    if (args.status) query.status = args.status;
    if (args.constructionStatus) query.constructionStatus = args.constructionStatus;
    if (args.seaView === true) query.hasSeaView = true;

    const limit = args.limit ?? DEFAULT_RESULTS;

    const units = await unitService.find(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "priceCurrency", select: "symbol abbreviation name"},
            {path: "project", select: "name"}
        ],
        "unitNumber name price area numberOfRooms numberOfBathrooms status constructionStatus hasSeaView priceCurrency project",
        {price: 1},
        limit
    );

    const results = units.map((u: any) => ({
        id: u._id?.toString(),
        name: u.name || u.unitNumber || null,
        unitNumber: u.unitNumber ?? null,
        price: priceToNumber(u.price),
        currency: u.priceCurrency?.abbreviation || u.priceCurrency?.symbol || null,
        area: u.area ?? null,
        rooms: u.numberOfRooms ?? null,
        bathrooms: u.numberOfBathrooms ?? null,
        status: u.status ?? null,
        constructionStatus: u.constructionStatus ?? null,
        seaView: u.hasSeaView ?? false,
        project: u.project?.name ?? null
    }));

    return {
        count: results.length,
        capped: results.length >= limit,
        results
    };
}

export const searchPropertiesTool: AssistantTool = {
    name: "search_properties",
    description:
        "Search the company's real-estate units (properties) by price range, area, " +
        "number of rooms, availability status, construction stage, or sea view. " +
        "Returns matching units with their price, currency, area, rooms and project. " +
        "Use this whenever the user asks to find, list, or filter properties/units.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPropertyManagementAssistantTools(): void {
    registerAssistantTool(searchPropertiesTool);
}
