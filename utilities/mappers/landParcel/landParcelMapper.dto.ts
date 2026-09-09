import type {DueDiligenceStep, LandParcel} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/landParcel.dto";
import type {ILandParcel, ILandParcelDueDiligenceStep} from "../../../database/schemas/landParcel/landParcel";
import {decimalToNumber, mapMedia, mapPopulatedRef, mapPopulatedSimpleCurrency, mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapDueDiligenceStep(entry: ILandParcelDueDiligenceStep): DueDiligenceStep {
    return {
        _id: entry._id?.toString() ?? "",
        title: entry.title,
        notes: entry.notes || undefined,
        performedBy: entry.performedBy ? mapPopulatedSimpleUser(entry.performedBy) : undefined,
        performedAt: entry.performedAt ? new Date(entry.performedAt).toISOString() : new Date().toISOString(),
        media: Array.isArray(entry.media) && entry.media.length > 0
            ? entry.media.map(mapMedia).filter((item) => item != null)
            : undefined,
    };
}

export function landParcelToDTO(landParcel: ILandParcel): LandParcel {
    return {
        _id: landParcel._id?.toString(),
        name: landParcel.name,
        title: landParcel.title,
        cadastralReference: landParcel.cadastralReference,
        description: landParcel.description,
        notes: landParcel.notes,
        status: landParcel.status,
        areaSqm: landParcel.areaSqm,
        zoning: landParcel.zoning,
        currency: mapPopulatedSimpleCurrency(landParcel.currency),
        acquisitionCost: decimalToNumber(landParcel.acquisitionCost),
        dueDiligenceStatus: landParcel.dueDiligenceStatus,
        dueDiligenceNotes: landParcel.dueDiligenceNotes,
        dueDiligenceSteps: Array.isArray(landParcel.dueDiligenceSteps) && landParcel.dueDiligenceSteps.length > 0
            ? landParcel.dueDiligenceSteps.map(mapDueDiligenceStep)
            : undefined,
        acquisitionNotes: landParcel.acquisitionNotes,
        disposeNotes: landParcel.disposeNotes,
        project: mapPopulatedRef(landParcel.project),
        edifice: mapPopulatedRef(landParcel.edifice),
        media: landParcel.media?.map(mapMedia).filter((item) => item != null),
        ...mapOwnershipToDTO(landParcel),
        ...mapLifeCycleToDTO(landParcel),
        ...mapSoftDeleteToDTO(landParcel)

    }
}

export function landParcelsToDTO(landParcels: ILandParcel[]): LandParcel[] {
    return landParcels.map(landParcelToDTO);
}
