import {decimal128ToNumber, objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import {IProject} from "../../../database/schemas/project/project";
import {IEdifice} from "../../../database/schemas/edifice/edifice";
import {IFloor} from "../../../database/schemas/floor/floor";
import {IUnit, UnitStatus} from "../../../database/schemas/unit/unit";
import type {MarketingProjectCatalogListItem} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.response.type";
import type {
    MarketingProjectCatalogSingleItem,
    MarketingUnitCatalogListItem,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectCatalog/marketingProjectCatalogSingle.form.response.type";
import {
    marketingMediaUrl,
    marketingMediaUrls,
} from "./marketing.mapper";
import {mapUnitTypeToPropertyTypeId} from "../../marketing/marketingPropertyType.util";
import {computeUnitCatalogStats} from "../../marketing/marketingCatalogFilters.util";
import {
    countFloorsForProject,
    resolvePrimaryCity,
} from "../../marketing/marketingCatalogHierarchy.util";
import type {MarketingCatalogPolygonData} from "../../marketing/marketingCatalogPolygon.util";

function slugifyName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function formatEdificeLocation(edifice: IEdifice | any): string | undefined {
    const city = edifice?.address?.city?.name;
    const country = edifice?.address?.country?.name;
    if (city && country) {
        return `${city}, ${country}`;
    }
    return city || country || edifice?.address?.street || undefined;
}

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

function buildCatalogBaseFields(
    project: IProject | any,
    edifices: IEdifice[] | any[],
    units: IUnit[] | any[],
    floorsByEdifice: Map<string, IFloor[] | any[]>,
): Omit<MarketingProjectCatalogListItem, "_id" | "name"> {
    const stats = computeUnitCatalogStats(units);
    const firstEdifice = edifices[0];
    const city = resolvePrimaryCity(edifices);

    return {
        slug: slugifyName(project.name),
        location: firstEdifice ? formatEdificeLocation(firstEdifice) : undefined,
        city,
        mainImage: marketingMediaUrl(project.mainImage),
        imageGallery: marketingMediaUrls(project.imageGallery),
        minSharePrice: stats.minPrice,
        maxSharePrice: stats.maxPrice,
        projectedYieldPercent: undefined,
        ownershipType: "co-ownership",
        status: "active",
        unitCount: stats.unitCount,
        availableUnitCount: stats.availableUnitCount,
        edificeCount: edifices.length,
        floorCount: countFloorsForProject(edifices, floorsByEdifice),
        propertyTypes: stats.propertyTypes.length > 0 ? stats.propertyTypes : undefined,
        bedroomRange:
            stats.minBedrooms != null && stats.maxBedrooms != null
                ? {min: stats.minBedrooms, max: stats.maxBedrooms}
                : undefined,
        areaSqmRange:
            stats.minArea != null && stats.maxArea != null
                ? {min: stats.minArea, max: stats.maxArea}
                : undefined,
    };
}

export function mapMarketingProjectCatalogListItem(
    project: IProject | any,
    edifices: IEdifice[] | any[],
    units: IUnit[] | any[],
    floorsByEdifice: Map<string, IFloor[] | any[]>,
): MarketingProjectCatalogListItem {
    return {
        _id: objectIdToString(project._id),
        name: project.name,
        ...buildCatalogBaseFields(project, edifices, units, floorsByEdifice),
    };
}

export function mapMarketingUnitCatalogListItem(
    unit: IUnit | any,
    floor: IFloor | any,
    edifice: IEdifice | any,
): MarketingUnitCatalogListItem {
    const price = decimal128ToNumber(unit.price);
    return {
        _id: objectIdToString(unit._id),
        name: unit.name,
        status: mapUnitStatus(unit.status),
        areaSqm: unit.netArea ?? unit.area,
        bedrooms: unit.numberOfRooms,
        bathrooms: unit.numberOfBathrooms,
        price,
        mainImage: marketingMediaUrl(unit.mainImage),
        propertyType: mapUnitTypeToPropertyTypeId(unit.unitType),
        floorLabel: floor?.name,
        edificeId: edifice ? objectIdToString(edifice._id) : undefined,
        floorId: floor ? objectIdToString(floor._id) : undefined,
    };
}

export function mapMarketingProjectCatalogSingle(
    project: IProject | any,
    edifices: IEdifice[] | any[],
    floorsByEdifice: Map<string, IFloor[] | any[]>,
    unitsByFloor: Map<string, IUnit[] | any[]>,
    units: IUnit[] | any[],
    polygonData?: MarketingCatalogPolygonData,
): MarketingProjectCatalogSingleItem {
    const base = buildCatalogBaseFields(project, edifices, units, floorsByEdifice);
    const firstEdifice = edifices[0];
    const projectKey = objectIdToString(project._id);

    const edificesCoordinates = polygonData?.edificesCoordinatesByProject.get(projectKey);
    const mappedEdificesCoordinates = edificesCoordinates && edificesCoordinates.length > 0
        ? edificesCoordinates
        : undefined;

    const floorPlans = edifices.flatMap((edifice) => {
        const floors = floorsByEdifice.get(objectIdToString(edifice._id)) ?? [];
        return floors
            .filter((floor) => floor.mainImage)
            .map((floor) => ({
                label: `${edifice.name} – ${floor.name}`,
                url: marketingMediaUrl(floor.mainImage)!,
            }));
    }).filter((plan) => Boolean(plan.url));

    return {
        _id: projectKey,
        name: project.name,
        ...base,
        description: project.description || undefined,
        amenities: [],
        latitude: firstEdifice?.address?.latitude,
        longitude: firstEdifice?.address?.longitude,
        floorPlans: floorPlans.length > 0 ? floorPlans : undefined,
        edificesCoordinates: mappedEdificesCoordinates,
        edifices: edifices.map((edifice) => {
            const edificeId = objectIdToString(edifice._id);
            const floors = floorsByEdifice.get(edificeId) ?? [];
            const floorsCoordinates = polygonData?.floorsCoordinatesByEdifice.get(edificeId);
            const mappedFloorsCoordinates = floorsCoordinates && floorsCoordinates.length > 0
                ? floorsCoordinates
                : undefined;

            return {
                _id: edificeId,
                name: edifice.name,
                mainImage: marketingMediaUrl(edifice.mainImage),
                floorsCoordinates: mappedFloorsCoordinates,
                floors: floors.map((floor) => {
                    const floorId = objectIdToString(floor._id);
                    const floorUnits = unitsByFloor.get(floorId) ?? [];
                    const unitsCoordinates = polygonData?.unitsCoordinatesByFloor.get(floorId);
                    const mappedUnitsCoordinates = unitsCoordinates && unitsCoordinates.length > 0
                        ? unitsCoordinates
                        : undefined;

                    return {
                        _id: floorId,
                        name: floor.name,
                        mainImage: marketingMediaUrl(floor.mainImage),
                        levelNumber: floor.levelNumber,
                        unitsCoordinates: mappedUnitsCoordinates,
                        units: floorUnits.map((unit) => mapMarketingUnitCatalogListItem(unit, floor, edifice)),
                    };
                }),
            };
        }),
    };
}
