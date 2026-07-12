/**
 * `get_property_details` — AI-assistant tool for the full detail of one unit.
 *
 * The natural follow-up to `search_properties`: once the user has a shortlist,
 * they ask "tell me more about unit A" / "details for A-102". This fetches a
 * single real-estate unit by its id or unit number and returns a rich view
 * (areas, amenities, views, location, availability) for the model to summarise.
 *
 * SECURITY: arguments come from the LLM and are untrusted. They are re-validated
 * with Zod here, and the lookup is hard-scoped to the calling human's company
 * ({@link AssistantToolContext.companyId}) with soft-deleted units excluded. The
 * model cannot widen this scope or reach another company's units by id.
 *
 * @module getPropertyDetailsTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";

/**
 * Zod schema re-validating the model's arguments. Lookup is by `id` (Mongo
 * ObjectId) or `unitNumber` — at least one is required. Unknown keys stripped.
 */
const GetPropertyDetailsArgs = z
    .object({
        id: z.string().trim().min(1).optional(),
        unitNumber: z.string().trim().min(1).optional()
    })
    .strip()
    .refine(args => args.id != null || args.unitNumber != null, {
        message: "Provide either 'id' or 'unitNumber'."
    });

/** JSON Schema shown to the model. Mirrors {@link GetPropertyDetailsArgs}. */
const parameters = {
    type: "object" as const,
    properties: {
        id: {
            type: "string",
            description: "The unit's unique id, as returned in `search_properties` results (field `id`)."
        },
        unitNumber: {
            type: "string",
            description: "The unit's human unit number (e.g. \"A-102\"), if the id is not known."
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
    const args = GetPropertyDetailsArgs.parse(rawArgs ?? {});

    // Hard company scope — the only scope the tool is allowed to read.
    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    // The model often fills BOTH fields (frequently copying the unit number into
    // `id`). Prefer a genuinely valid ObjectId; otherwise fall back to the unit
    // number. Only when `id` is the sole input AND it's malformed do we bail.
    const validId = args.id != null && ObjectId.isValid(args.id) ? args.id : undefined;
    if (validId) {
        query._id = new ObjectId(validId);
    } else if (args.unitNumber != null) {
        query.unitNumber = args.unitNumber;
    } else {
        return {found: false, reason: `"${args.id}" is not a valid unit id.`};
    }

    const unit: any = await unitService.findOne(
        query,
        {logger: ctx.logger, languageCode: ctx.languageCode, withDeleted: false},
        [
            {path: "priceCurrency", select: "symbol abbreviation name"},
            {path: "project", select: "name"},
            {path: "edifice", select: "name"},
            {path: "floor", select: "name"}
        ],
        "unitNumber name unitType area netArea sharedArea verandaArea price priceCurrency " +
            "numberOfRooms numberOfBathrooms status constructionStatus orientation description " +
            "hasBalcony hasTerrace hasSeaView hasCityView hasLakeView hasElevator " +
            "project edifice floor reservation sale"
    );

    if (!unit) {
        const by = args.id != null ? `id "${args.id}"` : `unit number "${args.unitNumber}"`;
        return {found: false, reason: `No unit found for ${by} in this company.`};
    }

    return {
        found: true,
        unit: {
            id: unit._id?.toString(),
            name: unit.name || unit.unitNumber || null,
            unitNumber: unit.unitNumber ?? null,
            unitType: unit.unitType ?? null,
            price: priceToNumber(unit.price),
            currency: unit.priceCurrency?.abbreviation || unit.priceCurrency?.symbol || null,
            area: unit.area ?? null,
            netArea: unit.netArea ?? null,
            sharedArea: unit.sharedArea ?? null,
            verandaArea: unit.verandaArea ?? null,
            rooms: unit.numberOfRooms ?? null,
            bathrooms: unit.numberOfBathrooms ?? null,
            status: unit.status ?? null,
            constructionStatus: unit.constructionStatus ?? null,
            orientation: unit.orientation ?? null,
            description: unit.description ?? null,
            amenities: {
                balcony: unit.hasBalcony ?? false,
                terrace: unit.hasTerrace ?? false,
                seaView: unit.hasSeaView ?? false,
                cityView: unit.hasCityView ?? false,
                lakeView: unit.hasLakeView ?? false,
                elevator: unit.hasElevator ?? false
            },
            location: {
                project: unit.project?.name ?? null,
                building: unit.edifice?.name ?? null,
                floor: unit.floor?.name ?? null
            },
            isReserved: unit.reservation != null,
            isSold: unit.sale != null
        }
    };
}

export const getPropertyDetailsTool: AssistantTool = {
    name: "get_property_details",
    description:
        "Get the full details of a single real-estate unit (property) by its id or " +
        "unit number: areas, price, rooms, amenities (balcony, terrace, sea/city/lake " +
        "view, elevator), orientation, description, location (project, building, floor), " +
        "and whether it is reserved or sold. Use this when the user asks about one " +
        "specific unit — typically after finding it with search_properties.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPropertyDetailsAssistantTools(): void {
    registerAssistantTool(getPropertyDetailsTool);
}
