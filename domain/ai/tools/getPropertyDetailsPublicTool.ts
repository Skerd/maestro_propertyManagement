/**
 * `get_property_details_public` — single-unit detail for ANONYMOUS website visitors.
 *
 * A deliberate sibling of {@link module:getPropertyDetailsTool} rather than an
 * audience flag on it. This is the richest single-record view the assistant can
 * produce, so the public version keeps its own explicit allowlist projection:
 * adding a field to the internal tool can never silently widen what a stranger
 * on the website sees. The two are expected to drift, and that is the point.
 *
 * Everything returned here is information the marketing site already publishes
 * for the unit.
 *
 * SECURITY: arguments come from the LLM and are untrusted. They are re-validated
 * with Zod, the lookup is hard-scoped to the conversation's company, and
 * soft-deleted units are excluded. The model cannot widen this scope.
 *
 * @module getPropertyDetailsPublicTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";

const GetPropertyDetailsPublicArgs = z
    .object({
        id: z.string().trim().min(1).optional(),
        unitNumber: z.string().trim().min(1).optional()
    })
    .strip()
    .refine(args => args.id != null || args.unitNumber != null, {
        message: "Provide either 'id' or 'unitNumber'."
    });

const parameters = {
    type: "object" as const,
    properties: {
        id: {
            type: "string",
            description: "The property's unique id, as returned in `search_properties` results (field `id`)."
        },
        unitNumber: {
            type: "string",
            description: "The property's reference number (e.g. \"A-102\"), if the id is not known."
        }
    },
    required: [] as string[]
};

/**
 * Fields read from the unit. Kept as a literal allowlist — NEVER widen this to
 * a broad select. Internal commercial data (reservation/sale records, internal
 * pricing, owner details) is intentionally absent.
 */
const PUBLIC_UNIT_FIELDS =
    "unitNumber name unitType area netArea verandaArea price priceCurrency " +
    "numberOfRooms numberOfBathrooms status constructionStatus orientation description " +
    "hasBalcony hasTerrace hasSeaView hasCityView hasLakeView hasElevator " +
    "project edifice floor";

function priceToNumber(price: unknown): number | null {
    if (price == null) return null;
    const n = parseFloat(price.toString());
    return Number.isFinite(n) ? n : null;
}

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = GetPropertyDetailsPublicArgs.parse(rawArgs ?? {});

    const query: Record<string, unknown> = {company: new ObjectId(ctx.companyId)};

    // Mirrors the internal tool's tolerance: small models routinely fill BOTH
    // fields, copying the unit number into `id`. Prefer a valid ObjectId, else
    // fall back to the unit number.
    const validId = args.id != null && ObjectId.isValid(args.id) ? args.id : undefined;
    if (validId) {
        query._id = new ObjectId(validId);
    } else if (args.unitNumber != null) {
        query.unitNumber = args.unitNumber;
    } else {
        return {found: false, reason: `"${args.id}" is not a valid property id.`};
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
        PUBLIC_UNIT_FIELDS
    );

    if (!unit) {
        const by = args.id != null ? `id "${args.id}"` : `reference "${args.unitNumber}"`;
        return {found: false, reason: `No property found for ${by}.`};
    }

    return {
        found: true,
        property: {
            id: unit._id?.toString(),
            name: unit.name || unit.unitNumber || null,
            reference: unit.unitNumber ?? null,
            type: unit.unitType ?? null,
            price: priceToNumber(unit.price),
            currency: unit.priceCurrency?.abbreviation || unit.priceCurrency?.symbol || null,
            area: unit.area ?? null,
            netArea: unit.netArea ?? null,
            verandaArea: unit.verandaArea ?? null,
            rooms: unit.numberOfRooms ?? null,
            bathrooms: unit.numberOfBathrooms ?? null,
            availability: unit.status ?? null,
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
            }
        }
    };
}

export const getPropertyDetailsPublicTool: AssistantTool = {
    name: "get_property_details_public",
    audience: "public",
    description:
        "Get the details of a single property by its id or reference number: size, " +
        "price, rooms, amenities (balcony, terrace, sea/city/lake view, elevator), " +
        "orientation, description, location (project, building, floor) and whether it " +
        "is still available. Use this when the visitor asks about one specific " +
        "property — typically after finding it with search_properties.",
    parameters,
    execute
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPublicPropertyDetailsAssistantTools(): void {
    registerAssistantTool(getPropertyDetailsPublicTool);
}
