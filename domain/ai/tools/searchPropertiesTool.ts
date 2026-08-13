/**
 * `search_properties` — AI-assistant tool for finding real-estate units.
 *
 * Lets the assistant answer questions like "find properties between 150k and
 * 200k euro", "what's available in Seaside Towers?", "3-bedroom flats with a
 * terrace in Block B" by querying real units. Registered into the core tool
 * registry at startup; the brain (core) never imports this module directly.
 *
 * SECURITY: the arguments come from the LLM and are untrusted. They are
 * re-validated with Zod here, and every query is hard-scoped to the calling
 * human's company ({@link AssistantToolContext.companyId}) with soft-deleted
 * units excluded. Project/building names are resolved to ids *within that same
 * company scope*, so a model-supplied name can never reach another tenant's
 * units. The model cannot widen this scope.
 *
 * @module searchPropertiesTool
 */

import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {
    UnitStatus,
    UNIT_CONSTRUCTION_STATUS_VALUES
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {
    DEFAULT_RESULTS,
    MAX_RESULTS,
    companyScope,
    emptyResult,
    findOptions,
    limitArg,
    limitParameter,
    listResult,
    numberRange,
    regexClause,
    resolveEdificeIds,
    resolveProjectIds,
    toNumber
} from "./assistantToolHelpers";

const STATUS_VALUES = Object.values(UnitStatus) as string[];
const CONSTRUCTION_STATUS_VALUES = [...UNIT_CONSTRUCTION_STATUS_VALUES];

/** Sort orders the model may request, mapped to real Mongo sorts. */
const SORT_ORDERS: Record<string, Record<string, 1 | -1>> = {
    price_asc: {price: 1},
    price_desc: {price: -1},
    area_asc: {area: 1},
    area_desc: {area: -1},
    newest: {createdAt: -1}
};
const SORT_VALUES = Object.keys(SORT_ORDERS);

/**
 * Zod schema re-validating the model's arguments. All fields optional; numbers
 * are coerced so string/number both parse. Unknown keys are stripped.
 */
const SearchPropertiesArgs = z.object({
    projectName: z.string().trim().min(1).optional(),
    buildingName: z.string().trim().min(1).optional(),
    unitNumber: z.string().trim().min(1).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minArea: z.coerce.number().nonnegative().optional(),
    maxArea: z.coerce.number().nonnegative().optional(),
    minRooms: z.coerce.number().int().nonnegative().optional(),
    maxRooms: z.coerce.number().int().nonnegative().optional(),
    minBathrooms: z.coerce.number().int().nonnegative().optional(),
    status: z.enum(STATUS_VALUES as [string, ...string[]]).optional(),
    constructionStatus: z.enum(CONSTRUCTION_STATUS_VALUES as [string, ...string[]]).optional(),
    seaView: z.coerce.boolean().optional(),
    cityView: z.coerce.boolean().optional(),
    lakeView: z.coerce.boolean().optional(),
    balcony: z.coerce.boolean().optional(),
    terrace: z.coerce.boolean().optional(),
    elevator: z.coerce.boolean().optional(),
    sortBy: z.enum(SORT_VALUES as [string, ...string[]]).optional(),
    limit: limitArg
}).strip();

/** JSON Schema shown to the model. Mirrors {@link SearchPropertiesArgs}. */
const parameters = {
    type: "object" as const,
    properties: {
        projectName: {
            type: "string",
            description: "Only units in the project (development) whose name matches this, e.g. \"Seaside Towers\"."
        },
        buildingName: {
            type: "string",
            description: "Only units in the building (edifice/block) whose name matches this, e.g. \"Block A\"."
        },
        unitNumber: {
            type: "string",
            description: "Match units whose unit number contains this text. For one specific unit, prefer get_property_details."
        },
        minPrice: {type: "number", description: "Minimum unit price (in the unit's own currency)."},
        maxPrice: {type: "number", description: "Maximum unit price (in the unit's own currency)."},
        minArea: {type: "number", description: "Minimum area in square meters."},
        maxArea: {type: "number", description: "Maximum area in square meters."},
        minRooms: {type: "integer", description: "Minimum number of rooms/bedrooms."},
        maxRooms: {type: "integer", description: "Maximum number of rooms/bedrooms. For an exact count, set minRooms and maxRooms to the same value."},
        minBathrooms: {type: "integer", description: "Minimum number of bathrooms."},
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
        cityView: {type: "boolean", description: "Only units that have a city view."},
        lakeView: {type: "boolean", description: "Only units that have a lake view."},
        balcony: {type: "boolean", description: "Only units that have a balcony."},
        terrace: {type: "boolean", description: "Only units that have a terrace."},
        elevator: {type: "boolean", description: "Only units served by an elevator."},
        sortBy: {
            type: "string",
            enum: SORT_VALUES,
            description: "Result order (default price_asc). Use price_desc for \"most expensive\", area_desc for \"largest\"."
        },
        limit: limitParameter
    },
    required: [] as string[]
};

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = SearchPropertiesArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = companyScope(ctx);

    // Names are resolved to ids inside the company scope. A name that matches
    // nothing returns an empty result rather than dropping the filter, which
    // would silently answer a broader question than the user asked.
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
    if (args.unitNumber != null) {
        query.unitNumber = regexClause(args.unitNumber);
    }

    const price = numberRange(args.minPrice, args.maxPrice);
    if (price) query.price = price;

    const area = numberRange(args.minArea, args.maxArea);
    if (area) query.area = area;

    const rooms = numberRange(args.minRooms, args.maxRooms);
    if (rooms) query.numberOfRooms = rooms;

    if (args.minBathrooms != null) query.numberOfBathrooms = {$gte: args.minBathrooms};
    if (args.status) query.status = args.status;
    if (args.constructionStatus) query.constructionStatus = args.constructionStatus;

    // Amenity flags filter only on `true` — "no balcony" is not a question the
    // data answers reliably (the field is absent rather than false on old rows).
    if (args.seaView === true) query.hasSeaView = true;
    if (args.cityView === true) query.hasCityView = true;
    if (args.lakeView === true) query.hasLakeView = true;
    if (args.balcony === true) query.hasBalcony = true;
    if (args.terrace === true) query.hasTerrace = true;
    if (args.elevator === true) query.hasElevator = true;

    const limit = args.limit ?? DEFAULT_RESULTS;
    const sort = SORT_ORDERS[args.sortBy ?? "price_asc"];

    const units = await unitService.find(
        query,
        findOptions(ctx),
        [
            {path: "priceCurrency", select: "symbol abbreviation name"},
            {path: "project", select: "name"},
            {path: "edifice", select: "name"}
        ],
        "unitNumber name price area netArea numberOfRooms numberOfBathrooms status constructionStatus " +
            "hasSeaView hasCityView hasLakeView hasBalcony hasTerrace hasElevator priceCurrency project edifice",
        sort,
        limit
    );

    const results = units.map((u: any) => ({
        id: u._id?.toString(),
        name: u.name || u.unitNumber || null,
        unitNumber: u.unitNumber ?? null,
        price: toNumber(u.price),
        currency: u.priceCurrency?.abbreviation || u.priceCurrency?.symbol || null,
        area: u.area ?? null,
        netArea: u.netArea ?? null,
        rooms: u.numberOfRooms ?? null,
        bathrooms: u.numberOfBathrooms ?? null,
        status: u.status ?? null,
        constructionStatus: u.constructionStatus ?? null,
        amenities: {
            seaView: u.hasSeaView ?? false,
            cityView: u.hasCityView ?? false,
            lakeView: u.hasLakeView ?? false,
            balcony: u.hasBalcony ?? false,
            terrace: u.hasTerrace ?? false,
            elevator: u.hasElevator ?? false
        },
        project: u.project?.name ?? null,
        building: u.edifice?.name ?? null
    }));

    return listResult(unitService, query, results, ctx);
}

export const searchPropertiesTool: AssistantTool = {
    name: "search_properties",
    // Every field returned here (price, area, rooms, status, project/building
    // name, amenities) is already published on the marketing site, so this is
    // safe for anonymous website visitors as-is. Re-check if the projection widens.
    audience: "both",
    description:
        "Search the company's real-estate units (properties) by project or building " +
        "name, unit number, price range, area, rooms, bathrooms, availability status, " +
        "construction stage, or amenities (sea/city/lake view, balcony, terrace, " +
        "elevator). Returns each unit's price, currency, area, rooms, status and " +
        "location, plus `total` — the true number of matching units, which is what " +
        "you must quote when asked how many. Use this whenever the user asks to find, " +
        "list, count or filter properties/units.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPropertyManagementAssistantTools(): void {
    registerAssistantTool(searchPropertiesTool);
}
