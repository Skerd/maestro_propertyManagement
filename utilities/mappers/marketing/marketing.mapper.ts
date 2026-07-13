import {ObjectId} from "mongodb";
import {decimal128ToNumber, objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import {IProject} from "../../../database/schemas/project/project";
import {IEdifice} from "../../../database/schemas/edifice/edifice";
import {IFloor} from "../../../database/schemas/floor/floor";
import {IUnit, UnitStatus} from "../../../database/schemas/unit/unit";
import {IUser} from "@coreModule/database/schemas/user/user";

import type {
    MarketingProjectSingleItem as MarketingProjectSingleDTO,
    MarketingUnitStatus
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProject/marketingProjectSingle.form.response.type";
import type {MarketingUnitSingleItem as MarketingUnitSingleDTO} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingUnit/marketingUnitSingle.form.response.type";
import type {MarketingTeamMemberItem as MarketingTeamMemberDTO} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingTeam/marketingTeam.form.response.type";
import {mapUnitTypeToPropertyTypeId} from "../../marketing/marketingPropertyType.util";
import {
    MarketingProjectListItem
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjects/marketingProjects.form.response.type";

const MEDIA_BASE = "/api/auxiliary/media/";

export type MarketingUnitSingleContext = {
    floor?: IFloor | any;
    totalFloorsInEdifice?: number;
};

export function marketingMediaUrl(media: {_id?: ObjectId | string} | null | undefined): string | undefined {
    if (!media?._id) {
        return undefined;
    }
    return `${MEDIA_BASE}${objectIdToString(media._id)}`;
}

export function marketingMediaUrls(mediaList: Array<{_id?: ObjectId | string} | null | undefined> | undefined): string[] {
    if (!Array.isArray(mediaList)) {
        return [];
    }
    return mediaList
        .map((item) => marketingMediaUrl(item))
        .filter((url): url is string => Boolean(url));
}

function mapUnitStatus(status: UnitStatus | string): MarketingUnitStatus {
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

function formatEdificeLocation(edifice: IEdifice | any): string | undefined {
    const city = edifice?.address?.city?.name;
    const country = edifice?.address?.country?.name;
    if (city && country) {
        return `${city}, ${country}`;
    }
    return city || country || edifice?.address?.street || undefined;
}

function slugifyName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

type ProjectUnitStats = {
    minPrice?: number;
    minSharePrice?: number;
};

export function computeProjectUnitStats(units: IUnit[] | any[]): ProjectUnitStats {
    let minPrice: number | undefined;
    for (const unit of units) {
        const price = decimal128ToNumber(unit.price);
        if (price == null) {
            continue;
        }
        if (minPrice == null || price < minPrice) {
            minPrice = price;
        }
    }
    return {
        minPrice,
        minSharePrice: minPrice,
    };
}

export function mapMarketingProjectListItem(
    project: IProject | any,
    edifices: IEdifice[] | any[],
    units: IUnit[] | any[],
): MarketingProjectListItem {
    const stats = computeProjectUnitStats(units);
    const firstEdifice = edifices[0];

    return {
        _id: objectIdToString(project._id),
        name: project.name,
        slug: slugifyName(project.name),
        location: firstEdifice ? formatEdificeLocation(firstEdifice) : undefined,
        mainImage: marketingMediaUrl(project.mainImage),
        imageGallery: marketingMediaUrls(project.imageGallery),
        minSharePrice: stats.minSharePrice,
        projectedYieldPercent: undefined,
        ownershipType: "co-ownership",
        status: "active",
    };
}

export function mapMarketingProjectSingle(
    project: IProject | any,
    edifices: IEdifice[] | any[],
    floorsByEdifice: Map<string, IFloor[] | any[]>,
    unitsByFloor: Map<string, IUnit[] | any[]>,
    units: IUnit[] | any[],
): MarketingProjectSingleDTO {
    const base = mapMarketingProjectListItem(project, edifices, units);
    const firstEdifice = edifices[0];

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
        ...base,
        description: project.description || undefined,
        amenities: [],
        latitude: firstEdifice?.address?.latitude,
        longitude: firstEdifice?.address?.longitude,
        floorPlans: floorPlans.length > 0 ? floorPlans : undefined,
        edifices: edifices.map((edifice) => {
            const edificeId = objectIdToString(edifice._id);
            const floors = floorsByEdifice.get(edificeId) ?? [];
            return {
                _id: edificeId,
                name: edifice.name,
                floors: floors.map((floor) => {
                    const floorId = objectIdToString(floor._id);
                    const floorUnits = unitsByFloor.get(floorId) ?? [];
                    return {
                        _id: floorId,
                        name: floor.name,
                        units: floorUnits.map((unit) => ({
                            _id: objectIdToString(unit._id),
                            name: unit.name,
                            status: mapUnitStatus(unit.status),
                        })),
                    };
                }),
            };
        }),
    };
}

function mapMarketingPriceCurrency(currency: any): {symbol?: string; abbreviation?: string} | undefined {
    if (!currency || typeof currency !== "object") {
        return undefined;
    }
    const symbol = currency.symbol ?? undefined;
    const abbreviation = currency.abbreviation ?? undefined;
    if (!symbol && !abbreviation) {
        return undefined;
    }
    return {symbol, abbreviation};
}

export function mapMarketingUnitSingle(
    unit: IUnit | any,
    projectId: string,
    context: MarketingUnitSingleContext = {},
): MarketingUnitSingleDTO {
    const price = decimal128ToNumber(unit.price);
    const {floor, totalFloorsInEdifice} = context;
    const floorLevel = floor?.levelNumber;
    const grossArea = unit.area ?? undefined;
    const priceCurrency = mapMarketingPriceCurrency(unit.priceCurrency);
    const averagePricePerSquareMeter =
        price != null && grossArea != null && grossArea > 0
            ? {
                value: price / grossArea,
                currency: priceCurrency,
            }
            : undefined;

    return {
        _id: objectIdToString(unit._id),
        name: unit.name,
        projectId,
        status: mapUnitStatus(unit.status),
        areaSqm: unit.netArea ?? unit.area,
        bedrooms: unit.numberOfRooms,
        bathrooms: unit.numberOfBathrooms,
        price,
        sharePrice: price,
        projectedYield: undefined,
        imageGallery: marketingMediaUrls([
            unit.mainImage,
            ...(unit.imageGallery ?? []),
        ]),
        description: unit.description || undefined,
        grossAreaSqm: grossArea,
        netAreaSqm: unit.netArea ?? undefined,
        sharedAreaSqm: unit.sharedArea ?? undefined,
        floorLabel: floor?.name,
        floorLevel: floorLevel != null ? floorLevel : undefined,
        totalFloorsInEdifice,
        propertyType: mapUnitTypeToPropertyTypeId(unit.unitType),
        floorPlanImage: marketingMediaUrl(unit.mainImage),
        priceCurrency,
        unitTypeName: unit.unitType?.name ?? undefined,
        averagePricePerSquareMeter,
        hasBalcony: unit.hasBalcony ?? undefined,
        hasTerrace: unit.hasTerrace ?? undefined,
        hasSeaView: unit.hasSeaView ?? undefined,
        hasCityView: unit.hasCityView ?? undefined,
        hasLakeView: unit.hasLakeView ?? undefined,
        hasElevator: unit.hasElevator ?? undefined,
    };
}

export function mapMarketingTeamMember(user: IUser | any): MarketingTeamMemberDTO {
    const companyRole = user.roles?.find((role: any) => role.active)?.role;
    const roleName = typeof companyRole === "object" && companyRole?.name
        ? companyRole.name
        : "Team member";

    return {
        _id: objectIdToString(user._id),
        name: [user.name, user.surname].filter(Boolean).join(" ").trim() || user.username,
        role: roleName,
        image: marketingMediaUrl(user.photo),
    };
}
