import {IEdifice} from "../../../database/schemas/edifice/edifice";
import {
    Edifice,
    EdificeFloorCoordinate,
    EdificeStatistics
} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto";
import type {CitySimple} from "armonia/src/modules/core/dto/city.dto";
import type {CountrySimple} from "armonia/src/modules/core/dto/country.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {StateSimple} from "armonia/src/modules/core/dto/state.dto";
import type {ConstructorSimple} from "armonia/src/modules/propertyManagement/dto/constructor.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitTypeSimple} from "armonia/src/modules/propertyManagement/dto/unitType.dto";
import {CitySimpleSnippet} from "@coreModule/database/schemas/city/city.snippets";
import {CountrySimpleSnippet} from "@coreModule/database/schemas/country/country.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {StateSimpleSnippet} from "@coreModule/database/schemas/state/state.snippets";
import {ConstructorSimpleSnippet} from "@propertyManagement/database/schemas/constructor/constructor.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitTypeSimpleSnippet} from "@propertyManagement/database/schemas/unitType/unitType.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
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
    const projectSimple = mapSnippet<ProjectSimple>()(edifice.project, ProjectSimpleSnippet);
    return {
        _id: edifice._id.toString(),
        name: edifice.name,
        address: {
            street: edifice.address?.street,
            postalCode: edifice.address?.postalCode,
            country: mapSnippet<CountrySimple>()(edifice.address?.country, CountrySimpleSnippet),
            state: mapSnippet<StateSimple>()(edifice.address?.state, StateSimpleSnippet),
            city: mapSnippet<CitySimple>()(edifice.address?.city, CitySimpleSnippet),
            latitude: edifice.address?.latitude,
            longitude: edifice.address?.longitude
        },
        distanceFromCityCenter: edifice.distanceFromCityCenter,
        totalArea: edifice.totalArea,
        greenArea: edifice.greenArea,
        investmentValue: edifice.investmentValue ? parseFloat(edifice.investmentValue.toString()) : undefined,
        investmentCurrency: mapSnippet<CurrencySimple>()(edifice.investmentCurrency, CurrencySimpleSnippet),
        pricePerMeterSquared: edifice.pricePerMeterSquared,
        verandaPricePerMeterSquared: edifice.verandaPricePerMeterSquared,
        saleCurrency: mapSnippet<CurrencySimple>()(edifice.saleCurrency, CurrencySimpleSnippet),
        numberOfFloors: edifice.numberOfFloors,
        numberOfParkingSpaces: edifice.numberOfParkingSpaces,
        numberOfGarages: edifice.numberOfGarages,
        numberOfFloorsAboveGround: edifice.numberOfFloorsAboveGround,
        numberOfFloorsUnderGround: edifice.numberOfFloorsUnderGround,
        commercialFacilities: edifice.commercialFacilities,
        neighborhoodFacilities: edifice.neighborhoodFacilities,
        constructors: edifice.constructors
            ?.map((constructor) => mapSnippet<ConstructorSimple>()(constructor, ConstructorSimpleSnippet))
            .filter((constructor): constructor is ConstructorSimple => !!constructor),
        propertyTypes: edifice.propertyTypes
            ?.map((unitType) => mapSnippet<UnitTypeSimple>()(unitType, UnitTypeSimpleSnippet))
            .filter((unitType): unitType is UnitTypeSimple => !!unitType),
        mainImage: edifice.mainImage ? mapMedia(edifice.mainImage) : undefined,
        imageGallery: !!edifice.imageGallery ? edifice.imageGallery?.map(mapMedia) : undefined,
        videoGallery: !!edifice.videoGallery ? edifice.videoGallery?.map(mapMedia) : undefined,
        mediaFiles: !!edifice.mediaFiles ? edifice.mediaFiles?.map(mapMedia) : undefined,
        marketingBooklet: edifice.marketingBooklet ? mapMedia(edifice.marketingBooklet) : undefined,
        project: projectSimple
            ? {
                ...projectSimple,
                mainImage: edifice.project?.mainImage ? mapMedia(edifice.project.mainImage) : undefined,
            }
            : undefined,
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
        priceVisibility: edifice.priceVisibility ?? "inherit",
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
