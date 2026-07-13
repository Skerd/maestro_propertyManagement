import {ObjectId} from "mongodb";
import {edificeService} from "../../database/schemas/edifice/edifice.service";
import {floorService} from "../../database/schemas/floor/floor.service";
import {unitService} from "../../database/schemas/unit/unit.service";
import {IEdifice} from "../../database/schemas/edifice/edifice";
import {IFloor} from "../../database/schemas/floor/floor";
import {IUnit} from "../../database/schemas/unit/unit";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import type {MarketingProjectHierarchy} from "./marketingHierarchy.util";

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const key = keyFn(item);
        const bucket = map.get(key) ?? [];
        bucket.push(item);
        map.set(key, bucket);
    }
    return map;
}

export async function loadMarketingCatalogHierarchy(
    projectIds: ObjectId[],
    companyId: ObjectId,
): Promise<MarketingProjectHierarchy> {
    if (projectIds.length === 0) {
        return {
            edifices: [],
            floors: [],
            units: [],
            floorsByEdifice: new Map(),
            unitsByFloor: new Map(),
            edificesByProject: new Map(),
            unitsByProject: new Map(),
        };
    }

    const edifices = await edificeService.find({
        project: {$in: projectIds},
        company: companyId,
        deletedAt: null,
    }, {}, ["mainImage", "address.city", "address.country"]);

    const edificeIds = edifices.map((edifice) => edifice._id);
    const floors = edificeIds.length > 0
        ? await floorService.find({
            edifice: {$in: edificeIds},
            company: companyId,
            deletedAt: null,
        }, {}, ["mainImage"])
        : [];

    const floorIds = floors.map((floor) => floor._id);
    const units = floorIds.length > 0
        ? await unitService.find({
            floor: {$in: floorIds},
            company: companyId,
            deletedAt: null,
        }, {}, ["unitType", "mainImage", "imageGallery"])
        : [];

    const floorsByEdifice = groupBy(floors, (floor) => objectIdToString((floor.edifice as any)?._id ?? floor.edifice));
    const unitsByFloor = groupBy(units, (unit) => objectIdToString((unit.floor as any)?._id ?? unit.floor));
    const edificesByProject = groupBy(edifices, (edifice) => objectIdToString((edifice.project as any)?._id ?? edifice.project));

    const edificeToProject = new Map<string, string>();
    for (const edifice of edifices) {
        edificeToProject.set(
            objectIdToString(edifice._id),
            objectIdToString((edifice.project as any)?._id ?? edifice.project),
        );
    }

    const unitsByProject = new Map<string, IUnit[]>();
    for (const unit of units) {
        const floorId = objectIdToString((unit.floor as any)?._id ?? unit.floor);
        for (const [edificeId, floorList] of floorsByEdifice.entries()) {
            if (floorList.some((floor) => objectIdToString(floor._id) === floorId)) {
                const projectId = edificeToProject.get(edificeId);
                if (projectId) {
                    const bucket = unitsByProject.get(projectId) ?? [];
                    bucket.push(unit);
                    unitsByProject.set(projectId, bucket);
                }
                break;
            }
        }
    }

    return {
        edifices,
        floors,
        units,
        floorsByEdifice,
        unitsByFloor,
        edificesByProject,
        unitsByProject,
    };
}

export async function loadMarketingCatalogHierarchyForProject(
    projectId: ObjectId,
    companyId: ObjectId,
): Promise<MarketingProjectHierarchy> {
    return loadMarketingCatalogHierarchy([projectId], companyId);
}

export function collectProjectCities(edifices: IEdifice[]): string[] {
    const cities = new Set<string>();
    for (const edifice of edifices) {
        const city = (edifice as any)?.address?.city?.name;
        if (typeof city === "string" && city.trim()) {
            cities.add(city.trim());
        }
    }
    return [...cities];
}

export function resolvePrimaryCity(edifices: IEdifice[]): string | undefined {
    const cities = collectProjectCities(edifices);
    return cities[0];
}

export function countFloorsForProject(
    edifices: IEdifice[],
    floorsByEdifice: Map<string, IFloor[]>,
): number {
    return edifices.reduce((total, edifice) => {
        const edificeId = objectIdToString(edifice._id);
        return total + (floorsByEdifice.get(edificeId)?.length ?? 0);
    }, 0);
}
