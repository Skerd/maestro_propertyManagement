import {IUnit} from "../../../database/schemas/unit/unit";
import {Unit, UnitStatistics} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto";
import {
    mapMedia,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

export type UnitToDtoOptions = {
    statistics?: UnitStatistics;
};

export type UnitsToDtoOptions = {
    statisticsByUnitId?: Record<string, UnitStatistics>;
};

export function unitToDTO(unit: IUnit, options?: UnitToDtoOptions): Unit {
    return {
        _id: unit._id.toString(),
        unitType: mapPopulatedRef(unit.unitType),
        unitNumber: unit.unitNumber,
        name: unit.name,
        area: unit.area,
        sharedArea: unit.sharedArea,
        netArea: unit.netArea,
        verandaArea: unit.verandaArea,
        price: unit.price ? parseFloat(unit.price.toString()) : undefined,
        priceCurrency: mapPopulatedSimpleCurrency(unit.priceCurrency),
        isAvailable: unit.status === UnitStatus.AVAILABLE,
        hasBalcony: !!unit.hasBalcony,
        hasTerrace: !!unit.hasTerrace,
        hasSeaView: !!unit.hasSeaView,
        hasCityView: !!unit.hasCityView,
        hasLakeView: !!unit.hasLakeView,
        hasElevator: !!unit.hasElevator,
        orientation: unit.orientation,
        constructionStatus: unit.constructionStatus,
        numberOfRooms: unit.numberOfRooms,
        numberOfBathrooms: unit.numberOfBathrooms,
        description: unit.description,
        mainImage: unit.mainImage ? mapMedia(unit.mainImage) : undefined,
        imageGallery: !!unit.imageGallery ? unit.imageGallery?.map(mapMedia) : undefined,
        videoGallery: !!unit.videoGallery ? unit.videoGallery?.map(mapMedia) : undefined,
        mediaFiles: !!unit.mediaFiles ? unit.mediaFiles?.map(mapMedia) : undefined,
        marketingBooklet: unit.marketingBooklet ? mapMedia(unit.marketingBooklet) : undefined,
        polygonCoordinates: unit.polygonCoordinates,
        status: unit.status,
        connectedUnits: !!unit.connectedUnits ? unit.connectedUnits?.map((unit) => {
            return {
                _id: unit._id.toString(),
                name: unit.name,
                unitNumber: unit.unitNumber,
                unitType: unit.unitType ? {
                    _id: unit.unitType._id.toString,
                    name: unit.unitType.name,
                    icon: unit.unitType.icon
                } : undefined,
            };
        }) : undefined,
        inspections: !!unit.inspections ? unit.inspections.map((inspection) => mapPopulatedRef(inspection)) : undefined,
        modificationRequests: !!unit.modificationRequests ?  unit.modificationRequests?.map((modificationRequest) => mapPopulatedRef(modificationRequest)): undefined,
        costs: !!unit.costs ? unit.costs.map((c: any) => mapPopulatedRef(c)) : undefined,
        reservation: mapPopulatedRef(unit.reservation),
        sale: mapPopulatedRef(unit.sale),
        saleCommissionRatePercent: unit.saleCommissionRatePercent,
        reservationCommissionRatePercent: unit.reservationCommissionRatePercent,
        priceHistory: Array.isArray(unit.priceHistory) && unit.priceHistory.length > 0
            ? unit.priceHistory.map((entry: any) => ({
                price: entry.price != null ? parseFloat(entry.price.toString()) : 0,
                currency: mapPopulatedSimpleCurrency(entry.currency),
                changedAt: entry.changedAt ? new Date(entry.changedAt).toISOString() : undefined,
                changedBy: entry.changedBy ? mapPopulatedSimpleUser(entry.changedBy) : undefined,
                reason: entry.reason || undefined,
            }))
            : undefined,
        project: unit?.floor?.edifice?.project ? mapPopulatedRef(unit.floor.edifice.project) : undefined,
        edifice: unit?.floor?.edifice ? mapPopulatedRef(unit.floor.edifice) : undefined,
        floor: unit.floor ? mapPopulatedRef(unit.floor) : undefined,
        statistics: options?.statistics,
        ...mapSoftDeleteToDTO(unit),
        ...mapOwnershipToDTO(unit),
        ...mapLifeCycleToDTO(unit)
    };
}

export function unitsToDTO(units: IUnit[] | any[], options?: UnitsToDtoOptions): Unit[] {
    const statsMap = options?.statisticsByUnitId;
    return units.map((unit) => {
        const unitObj = typeof unit?.toObject === "function" ? unit.toObject() : {...unit};
        const id = unitObj._id?.toString?.() ?? String(unitObj._id);
        const stats = statsMap?.[id];
        return unitToDTO(unitObj, {statistics: stats});
    });
}

