import {IFloor} from "../../../database/schemas/floor/floor";
import type {Floor, FloorStatistics} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/floor.dto";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import type {FloorUnitCoordinateRow} from "../../../database/schemas/floor/floor.service";

export type FloorToDtoOptions = {
    statistics?: FloorStatistics;
    unitsCoordinates?: FloorUnitCoordinateRow[];
};

export type FloorsToDtoOptions = {
    statisticsByFloorId?: Record<string, FloorStatistics>;
    unitsCoordinatesByFloorId?: Record<string, FloorUnitCoordinateRow[]>;
};

export function floorToDTO(floor: IFloor, options?: FloorToDtoOptions): Floor {
    return {
        _id: floor._id.toString(),
        name: floor.name,
        levelNumber: floor.levelNumber,
        totalUnits: floor.totalUnits,
        area: floor.area,
        isAccessible: floor.isAccessible,
        hasEmergencyExit: floor.hasEmergencyExit,
        description: floor.description,
        sharedSpaces: floor.sharedSpaces || [],
        polygonCoordinates: floor.polygonCoordinates || undefined,
        mainImage: floor.mainImage ? mapMedia(floor.mainImage) : undefined,
        imageGallery: !!floor.imageGallery ? floor.imageGallery?.map(mapMedia) : [],
        videoGallery: !!floor.videoGallery ? floor.videoGallery?.map(mapMedia) : [],
        mediaFiles: !!floor.mediaFiles ? floor.mediaFiles?.map(mapMedia) : undefined,
        marketingBooklet: floor.marketingBooklet ? mapMedia(floor.marketingBooklet) : undefined,
        edifice: mapPopulatedRef(floor.edifice),
        project: mapPopulatedRef(floor.edifice?.project),
        unitsCoordinates: options?.unitsCoordinates && options?.unitsCoordinates.length > 0 ? options?.unitsCoordinates : undefined,
        ...mapSoftDeleteToDTO(floor),
        ...mapOwnershipToDTO(floor),
        ...mapLifeCycleToDTO(floor),
        statistics: options?.statistics ? options?.statistics : undefined,
    };
}

export function floorsToDTO(floors: IFloor[] | any, options?: FloorsToDtoOptions): Floor[] {
    const returnThis: Floor[] = [];
    const statsMap = options?.statisticsByFloorId;
    const coordMap = options?.unitsCoordinatesByFloorId;
    for (const floor of floors) {
        const id = floor._id?.toString?.() ?? String(floor._id);
        returnThis.push(floorToDTO(floor, {statistics: statsMap?.[id], unitsCoordinates: coordMap?.[id],}));
    }
    return returnThis;
}
