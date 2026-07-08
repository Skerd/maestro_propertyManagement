import {IEdifice} from "../../../database/schemas/edifice/edifice";
import {
    Edifice,
    EdificeFloorCoordinate,
    EdificeStatistics
} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleCurrency} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export type EdificeToDtoOptions = {
    statistics?: EdificeStatistics;
    floorsCoordinates?: EdificeFloorCoordinate[];
};

export type EdificesToDtoOptions = {
    statisticsByEdificeId?: Record<string, EdificeStatistics>;
    floorsCoordinatesByEdificeId?: Record<string, EdificeFloorCoordinate[]>;
};

export function edificeToDTO(edifice: IEdifice, options?: EdificeToDtoOptions): Edifice {
    return {
        _id: edifice._id.toString(),
        name: edifice.name,
        address: {
            street: edifice.address?.street,
            postalCode: edifice.address?.postalCode,
            country: mapPopulatedRef(edifice.address?.country),
            state: edifice.address?.state ? mapPopulatedRef(edifice.address?.state) : undefined,
            city: mapPopulatedRef(edifice.address?.city),
            latitude: edifice.address?.latitude,
            longitude: edifice.address?.longitude
        },
        distanceFromCityCenter: edifice.distanceFromCityCenter,
        totalArea: edifice.totalArea,
        greenArea: edifice.greenArea,
        investmentValue: edifice.investmentValue ? parseFloat(edifice.investmentValue.toString()) : undefined,
        investmentCurrency: mapPopulatedSimpleCurrency(edifice.investmentCurrency),
        pricePerMeterSquared: edifice.pricePerMeterSquared,
        verandaPricePerMeterSquared: edifice.verandaPricePerMeterSquared,
        saleCurrency: edifice.saleCurrency ? mapPopulatedSimpleCurrency(edifice.saleCurrency) : undefined,
        numberOfFloors: edifice.numberOfFloors,
        numberOfParkingSpaces: edifice.numberOfParkingSpaces,
        numberOfGarages: edifice.numberOfGarages,
        numberOfFloorsAboveGround: edifice.numberOfFloorsAboveGround,
        numberOfFloorsUnderGround: edifice.numberOfFloorsUnderGround,
        commercialFacilities: edifice.commercialFacilities,
        neighborhoodFacilities: edifice.neighborhoodFacilities,
        constructors: !!edifice.constructors && Array.isArray(edifice.constructors) ? edifice.constructors?.map(mapPopulatedRef) : undefined,
        propertyTypes: !!edifice.propertyTypes ? edifice.propertyTypes?.map((unitType) => {
            return {
                _id: unitType._id?.toString() || unitType.toString(),
                name: unitType.name,
                icon: unitType.icon,
            }
        }) : undefined,
        mainImage: edifice.mainImage ? mapMedia(edifice.mainImage) : undefined,
        imageGallery: !!edifice.imageGallery ? edifice.imageGallery?.map(mapMedia) : undefined,
        videoGallery: !!edifice.videoGallery ? edifice.videoGallery?.map(mapMedia) : undefined,
        mediaFiles: !!edifice.mediaFiles ? edifice.mediaFiles?.map(mapMedia) : undefined,
        marketingBooklet: edifice.marketingBooklet ? mapMedia(edifice.marketingBooklet) : undefined,
        project: edifice.project ? {
            ...mapPopulatedRef(edifice.project),
            mainImage: (edifice.project as any).mainImage ? mapMedia((edifice.project as any).mainImage) : undefined,
        } : undefined,
        ...mapSoftDeleteToDTO(edifice),
        ...mapOwnershipToDTO(edifice),
        ...mapLifeCycleToDTO(edifice),
        floorsCoordinates: options?.floorsCoordinates?.length > 0 ? options?.floorsCoordinates : undefined,
        statistics: options?.statistics ? options?.statistics : undefined,
        polygonCoordinates: Array.isArray(edifice.polygonCoordinates) && edifice.polygonCoordinates.length > 0 ? edifice.polygonCoordinates.map((p: {x: number; y: number}) => ({x: p.x, y: p.y})) : undefined,
        constructionStartDate: edifice.constructionStartDate,
        expectedCompletionDate: edifice.expectedCompletionDate,
        actualCompletionDate: edifice.actualCompletionDate,
        buildingPermitNumber: edifice.buildingPermitNumber,
        energyClass: edifice.energyClass,
    };
}

export function edificesToDTO(edifices: IEdifice[] | any, options?: EdificesToDtoOptions): Edifice[] {
    const returnThis: Edifice[] = [];
    const statsMap = options?.statisticsByEdificeId;
    const coordMap = options?.floorsCoordinatesByEdificeId;
    for (const edifice of edifices) {
        const id = edifice._id?.toString?.() ?? String(edifice._id);
        returnThis.push(
            edificeToDTO(edifice, {
                statistics: statsMap?.[id],
                floorsCoordinates: coordMap?.[id],
            })
        );
    }
    return returnThis;
}

