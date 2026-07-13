import {ObjectId} from "mongodb";
import {edificeService} from "../../database/schemas/edifice/edifice.service";
import {floorService} from "../../database/schemas/floor/floor.service";
import {unitService} from "../../database/schemas/unit/unit.service";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

export type MarketingPolygonCoordinate = {x: number; y: number};

export type MarketingPolygonItem = {
    _id: string;
    name: string;
    polygonCoordinates: MarketingPolygonCoordinate[];
};

export type MarketingCatalogPolygonData = {
    edificesCoordinatesByProject: Map<string, MarketingPolygonItem[]>;
    floorsCoordinatesByEdifice: Map<string, MarketingPolygonItem[]>;
    unitsCoordinatesByFloor: Map<string, MarketingPolygonItem[]>;
};

function mapPolygonPoints(points: {x: number; y: number}[] | undefined | null): MarketingPolygonCoordinate[] {
    if (!Array.isArray(points)) {
        return [];
    }
    return points.map((point) => ({x: point.x, y: point.y}));
}

function toPolygonItem(entity: {_id: ObjectId | string; name?: string; polygonCoordinates?: {x: number; y: number}[]}): MarketingPolygonItem {
    return {
        _id: objectIdToString(entity._id),
        name: entity.name ?? "",
        polygonCoordinates: mapPolygonPoints(entity.polygonCoordinates),
    };
}

export async function loadMarketingCatalogPolygonData(
    projectIds: ObjectId[],
    edificeIds: ObjectId[],
    floorIds: ObjectId[],
    companyId: ObjectId,
    languageCode?: string,
): Promise<MarketingCatalogPolygonData> {
    const loggerOptions = languageCode ? {languageCode} : {};

    const edificesCoordinatesByProject = new Map<string, MarketingPolygonItem[]>();
    const floorsCoordinatesByEdifice = new Map<string, MarketingPolygonItem[]>();
    const unitsCoordinatesByFloor = new Map<string, MarketingPolygonItem[]>();

    if (projectIds.length > 0) {
        const edifices = await edificeService.find(
            {project: {$in: projectIds}, company: companyId, deletedAt: null},
            loggerOptions,
            null,
            "polygonCoordinates name project",
        );

        for (const edifice of edifices as any[]) {
            const projectId = objectIdToString((edifice.project as any)?._id ?? edifice.project);
            const item = toPolygonItem(edifice);
            if (item.polygonCoordinates.length === 0) {
                continue;
            }
            const bucket = edificesCoordinatesByProject.get(projectId) ?? [];
            bucket.push(item);
            edificesCoordinatesByProject.set(projectId, bucket);
        }
    }

    if (edificeIds.length > 0) {
        const floors = await floorService.find(
            {edifice: {$in: edificeIds}, company: companyId, deletedAt: null},
            loggerOptions,
            null,
            "polygonCoordinates name edifice",
        );

        for (const floor of floors as any[]) {
            const edificeId = objectIdToString((floor.edifice as any)?._id ?? floor.edifice);
            const item = toPolygonItem(floor);
            if (item.polygonCoordinates.length === 0) {
                continue;
            }
            const bucket = floorsCoordinatesByEdifice.get(edificeId) ?? [];
            bucket.push(item);
            floorsCoordinatesByEdifice.set(edificeId, bucket);
        }
    }

    if (floorIds.length > 0) {
        const units = await unitService.find(
            {floor: {$in: floorIds}, company: companyId, deletedAt: null},
            loggerOptions,
            null,
            "polygonCoordinates name floor",
        );

        for (const unit of units as any[]) {
            const floorId = objectIdToString((unit.floor as any)?._id ?? unit.floor);
            const item = toPolygonItem(unit);
            if (item.polygonCoordinates.length === 0) {
                continue;
            }
            const bucket = unitsCoordinatesByFloor.get(floorId) ?? [];
            bucket.push(item);
            unitsCoordinatesByFloor.set(floorId, bucket);
        }
    }

    return {
        edificesCoordinatesByProject,
        floorsCoordinatesByEdifice,
        unitsCoordinatesByFloor,
    };
}
