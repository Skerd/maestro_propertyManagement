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

function normalizeToken(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
}

function matchPropertyType(token: string): MarketingPropertyTypeId | undefined {
    const normalized = normalizeToken(token);
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

export function mapUnitTypeToPropertyTypeId(unitType: {
    name?: string;
    category?: string;
    slug?: string;
} | null | undefined): MarketingPropertyTypeId | undefined {
    if (!unitType) {
        return undefined;
    }
    const candidates = [unitType.slug, unitType.name, unitType.category].filter(Boolean) as string[];
    for (const candidate of candidates) {
        const matched = matchPropertyType(candidate);
        if (matched) {
            return matched;
        }
    }
    return undefined;
}
