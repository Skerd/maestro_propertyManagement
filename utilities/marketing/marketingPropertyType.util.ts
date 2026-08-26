import type {MarketingPropertyTypeId} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.shared.types";

const PROPERTY_TYPE_SYNONYMS: Record<string, MarketingPropertyTypeId> = {
    apartment: "apartment",
    apt: "apartment",
    flat: "apartment",
    studio: "studio",
    penthouse: "penthouse",
    commercial: "commercial",
    office: "commercial",
    retail: "commercial",
    villa: "villa",
    house: "villa",
};

function matchPropertyType(value: unknown): MarketingPropertyTypeId | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
    if (!normalized) {
        return undefined;
    }
    if (PROPERTY_TYPE_SYNONYMS[normalized]) {
        return PROPERTY_TYPE_SYNONYMS[normalized];
    }
    for (const [key, mapped] of Object.entries(PROPERTY_TYPE_SYNONYMS)) {
        if (normalized.includes(key)) {
            return mapped;
        }
    }
    return undefined;
}

/** `category` is an ObjectId ref (optionally populated `{name}`). Non-strings are skipped. */
export function mapUnitTypeToPropertyTypeId(unitType: {
    name?: unknown;
    slug?: unknown;
    group?: unknown;
    category?: unknown;
} | null | undefined): MarketingPropertyTypeId | undefined {
    if (!unitType) {
        return undefined;
    }
    const categoryName = (unitType.category as {name?: unknown} | undefined)?.name;
    for (const candidate of [unitType.slug, unitType.name, unitType.group, categoryName]) {
        const matched = matchPropertyType(candidate);
        if (matched) {
            return matched;
        }
    }
    return undefined;
}
