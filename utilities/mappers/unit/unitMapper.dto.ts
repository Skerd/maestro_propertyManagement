import {IUnit} from "../../../database/schemas/unit/unit";
import {Unit, UnitStatistics} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {InspectionSimple} from "armonia/src/modules/propertyManagement/dto/inspection.dto";
import type {ModificationRequestSimple} from "armonia/src/modules/propertyManagement/dto/modificationRequest.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {ReservationBlank} from "armonia/src/modules/propertyManagement/dto/reservation.dto";
import type {SaleBlank} from "armonia/src/modules/propertyManagement/dto/sale.dto";
import type {UnitCostSimple} from "armonia/src/modules/propertyManagement/dto/unitCost.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import type {UnitTypeSimple} from "armonia/src/modules/propertyManagement/dto/unitType.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {FloorSimpleSnippet} from "@propertyManagement/database/schemas/floor/floor.snippets";
import {InspectionSimpleSnippet} from "@propertyManagement/database/schemas/inspection/inspection.snippets";
import {ModificationRequestSimpleSnippet} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {ReservationBlankSnippet} from "@propertyManagement/database/schemas/reservation/reservation.snippets";
import {SaleBlankSnippet} from "@propertyManagement/database/schemas/sale/sale.snippets";
import {UnitCostSimpleSnippet} from "@propertyManagement/database/schemas/unitCost/unitCost.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {UnitTypeSimpleSnippet} from "@propertyManagement/database/schemas/unitType/unitType.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
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
        unitType: mapSnippet<UnitTypeSimple>()(unit.unitType, UnitTypeSimpleSnippet),
        unitNumber: unit.unitNumber,
        name: unit.name,
        area: unit.area,
        sharedArea: unit.sharedArea,
        netArea: unit.netArea,
        verandaArea: unit.verandaArea,
        price: unit.price ? parseFloat(unit.price.toString()) : undefined,
        priceCurrency: mapSnippet<CurrencySimple>()(unit.priceCurrency, CurrencySimpleSnippet),
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
        unavailableNotes: unit.unavailableNotes,
        connectedUnits: unit.connectedUnits
            ?.map((connected) => mapSnippet<UnitSimple>()(connected, UnitSimpleSnippet))
            .filter((connected): connected is UnitSimple => !!connected),
        inspections: unit.inspections
            ?.map((inspection) => mapSnippet<InspectionSimple>()(inspection, InspectionSimpleSnippet))
            .filter((inspection): inspection is InspectionSimple => !!inspection) ?? [],
        modificationRequests: unit.modificationRequests
            ?.map((request) => mapSnippet<ModificationRequestSimple>()(request, ModificationRequestSimpleSnippet))
            .filter((request): request is ModificationRequestSimple => !!request) ?? [],
        costs: unit.costs
            ?.map((cost) => mapSnippet<UnitCostSimple>()(cost, UnitCostSimpleSnippet))
            .filter((cost): cost is UnitCostSimple => !!cost),
        reservation: mapSnippet<ReservationBlank>()(unit.reservation, ReservationBlankSnippet),
        sale: mapSnippet<SaleBlank>()(unit.sale, SaleBlankSnippet),
        saleCommissionRatePercent: unit.saleCommissionRatePercent,
        reservationCommissionRatePercent: unit.reservationCommissionRatePercent,
        priceHistory: Array.isArray(unit.priceHistory) && unit.priceHistory.length > 0
            ? unit.priceHistory.map((entry) => ({
                price: entry.price != null ? parseFloat(entry.price.toString()) : 0,
                currency: mapSnippet<CurrencySimple>()(entry.currency, CurrencySimpleSnippet),
                changedAt: entry.changedAt ? new Date(entry.changedAt).toISOString() : undefined,
                changedBy: entry.changedBy
                    ? mapSnippet<SimpleBlankUser>()(entry.changedBy, SimpleBlankUserSnippet)
                    : undefined,
                reason: entry.reason || undefined,
            }))
            : undefined,
        project: unit.floor?.edifice?.project
            ? mapSnippet<ProjectSimple>()(unit.floor.edifice.project, ProjectSimpleSnippet)
            : undefined,
        edifice: unit.floor?.edifice
            ? mapSnippet<EdificeSimple>()(unit.floor.edifice, EdificeSimpleSnippet)
            : undefined,
        floor: unit.floor ? mapSnippet<FloorSimple>()(unit.floor, FloorSimpleSnippet) : undefined,
        featuredOnHomepage: !!unit.featuredOnHomepage,
        featuredSortOrder: unit.featuredSortOrder ?? 0,
        priceVisibility: unit.priceVisibility ?? "inherit",
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
