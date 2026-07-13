import {decimal128ToNumber} from "@coreModule/utilities/mappers/common.mapper";
import {UnitStatus, IUnit} from "../../database/schemas/unit/unit";
import type {
    MarketingProjectCatalogListItem,
    MarketingProjectsCatalogFilterOptions,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.response.type";
import type {
    MarketingBedroomFilter,
    MarketingPropertyTypeId,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.shared.types";
import {mapUnitTypeToPropertyTypeId} from "./marketingPropertyType.util";

export type CatalogProjectFilterParams = {
    search?: string;
    tab?: "real-estate" | "co-ownership" | "tokenization";
    projectId?: string;
    city?: string;
    propertyType?: MarketingPropertyTypeId;
    bedrooms?: MarketingBedroomFilter;
    areaSqmMin?: number;
    priceMin?: number;
    priceMax?: number;
};

function mapUnitStatus(status: UnitStatus | string): "available" | "reserved" | "sold" {
    switch (status) {
        case UnitStatus.RESERVED:
        case "reserved_unit":
            return "reserved";
        case UnitStatus.SOLD:
        case "sold_unit":
            return "sold";
        default:
            return "available";
    }
}

function unitAreaSqm(unit: IUnit | any): number | undefined {
    const area = unit.netArea ?? unit.area;
    return typeof area === "number" ? area : undefined;
}

function unitPrice(unit: IUnit | any): number | undefined {
    return decimal128ToNumber(unit.price);
}

function unitBedrooms(unit: IUnit | any): number | undefined {
    return typeof unit.numberOfRooms === "number" ? unit.numberOfRooms : undefined;
}

function unitPropertyType(unit: IUnit | any): MarketingPropertyTypeId | undefined {
    return mapUnitTypeToPropertyTypeId(unit.unitType);
}

function isAvailableUnit(unit: IUnit | any): boolean {
    return mapUnitStatus(unit.status) === "available";
}

export function projectMatchesCatalogFilters(
    project: MarketingProjectCatalogListItem,
    units: IUnit[],
    params: CatalogProjectFilterParams,
): boolean {
    if (params.projectId && project._id !== params.projectId) {
        return false;
    }

    if (params.city && params.city !== "any") {
        const city = project.city?.toLowerCase();
        if (!city || city !== params.city.toLowerCase()) {
            return false;
        }
    }

    if (params.search?.trim()) {
        const query = params.search.trim().toLowerCase();
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesLocation = project.location?.toLowerCase().includes(query);
        if (!matchesName && !matchesLocation) {
            return false;
        }
    }

    if (params.propertyType) {
        if (!project.propertyTypes?.includes(params.propertyType)) {
            return false;
        }
    }

    if (params.bedrooms && params.bedrooms !== "any") {
        const minBedrooms = params.bedrooms === "6+" ? 6 : Number(params.bedrooms);
        if (Number.isFinite(minBedrooms)) {
            const hasMatch = units.some((unit) => {
                const bedrooms = unitBedrooms(unit);
                if (bedrooms == null) {
                    return false;
                }
                return params.bedrooms === "6+" ? bedrooms >= 6 : bedrooms === minBedrooms;
            });
            if (!hasMatch) {
                return false;
            }
        }
    }

    if (params.areaSqmMin != null && params.areaSqmMin > 0) {
        const hasMatch = units.some((unit) => {
            const area = unitAreaSqm(unit);
            return area != null && area >= params.areaSqmMin!;
        });
        if (!hasMatch) {
            return false;
        }
    }

    if (params.priceMin != null || params.priceMax != null) {
        const min = params.priceMin ?? 0;
        const max = params.priceMax ?? Number.MAX_SAFE_INTEGER;
        const hasMatch = units.some((unit) => {
            const price = unitPrice(unit);
            return price != null && price >= min && price <= max;
        });
        if (!hasMatch) {
            const projectMin = project.minSharePrice;
            const projectMax = project.maxSharePrice;
            const projectOverlaps =
                projectMin != null &&
                projectMax != null &&
                projectMax >= min &&
                projectMin <= max;
            if (!projectOverlaps) {
                return false;
            }
        }
    }

    return true;
}

export function buildCatalogFilterOptions(
    projects: MarketingProjectCatalogListItem[],
): MarketingProjectsCatalogFilterOptions {
    const cities = new Set<string>();
    const propertyTypes = new Set<MarketingPropertyTypeId>();
    const bedroomOptions = new Set<string>();
    let priceMin = Number.POSITIVE_INFINITY;
    let priceMax = 0;

    for (const project of projects) {
        if (project.city) {
            cities.add(project.city);
        }
        project.propertyTypes?.forEach((type) => propertyTypes.add(type));
        if (project.bedroomRange) {
            for (let i = project.bedroomRange.min; i <= project.bedroomRange.max; i++) {
                bedroomOptions.add(String(i));
            }
            if (project.bedroomRange.max >= 6) {
                bedroomOptions.add("6+");
            }
        }
        if (project.minSharePrice != null) {
            priceMin = Math.min(priceMin, project.minSharePrice);
            priceMax = Math.max(priceMax, project.maxSharePrice ?? project.minSharePrice);
        }
    }

    if (!Number.isFinite(priceMin)) {
        priceMin = 0;
    }
    if (priceMax <= 0) {
        priceMax = priceMin;
    }

    return {
        cities: [...cities].sort((a, b) => a.localeCompare(b)),
        propertyTypes: [...propertyTypes],
        bedroomOptions: [...bedroomOptions].sort((a, b) => {
            if (a === "6+") return 1;
            if (b === "6+") return -1;
            return Number(a) - Number(b);
        }),
        priceBounds: {min: priceMin, max: priceMax},
        projects: projects.map((project) => ({_id: project._id, name: project.name})),
    };
}

export function applyCatalogProjectFilters(
    projects: MarketingProjectCatalogListItem[],
    unitsByProject: Map<string, IUnit[]>,
    params: CatalogProjectFilterParams,
): MarketingProjectCatalogListItem[] {
    return projects.filter((project) =>
        projectMatchesCatalogFilters(project, unitsByProject.get(project._id) ?? [], params),
    );
}

export function computeUnitCatalogStats(units: IUnit[] | any[]) {
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    let minBedrooms: number | undefined;
    let maxBedrooms: number | undefined;
    let minArea: number | undefined;
    let maxArea: number | undefined;
    let availableUnitCount = 0;
    const propertyTypes = new Set<MarketingPropertyTypeId>();

    for (const unit of units) {
        const price = unitPrice(unit);
        if (price != null) {
            minPrice = minPrice == null ? price : Math.min(minPrice, price);
            maxPrice = maxPrice == null ? price : Math.max(maxPrice, price);
        }

        const bedrooms = unitBedrooms(unit);
        if (bedrooms != null) {
            minBedrooms = minBedrooms == null ? bedrooms : Math.min(minBedrooms, bedrooms);
            maxBedrooms = maxBedrooms == null ? bedrooms : Math.max(maxBedrooms, bedrooms);
        }

        const area = unitAreaSqm(unit);
        if (area != null) {
            minArea = minArea == null ? area : Math.min(minArea, area);
            maxArea = maxArea == null ? area : Math.max(maxArea, area);
        }

        const propertyType = unitPropertyType(unit);
        if (propertyType) {
            propertyTypes.add(propertyType);
        }

        if (isAvailableUnit(unit)) {
            availableUnitCount += 1;
        }
    }

    return {
        minPrice,
        maxPrice,
        minBedrooms,
        maxBedrooms,
        minArea,
        maxArea,
        availableUnitCount,
        unitCount: units.length,
        propertyTypes: [...propertyTypes],
    };
}
