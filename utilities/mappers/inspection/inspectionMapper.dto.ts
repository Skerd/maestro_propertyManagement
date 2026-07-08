import {IInspection} from "../../../database/schemas/inspection/inspection";
import {Inspection, InspectionFindings} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.dto";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

const FINDINGS_KEYS = [
    "structuralIssues", "electricalIssues", "plumbingIssues", "hvacIssues",
    "safetyConcerns", "cosmeticIssues", "otherObservations",
] as const;

function mapFindings(findings: any): InspectionFindings | undefined {
    if (!findings || typeof findings !== "object") return undefined;
    const result: InspectionFindings = {};
    for (const key of FINDINGS_KEYS) {
        const items = findings[key];
        if (!Array.isArray(items) || items.length === 0) continue;
        result[key] = items.map((item: any) => ({
            notes:     item.notes,
            media:     Array.isArray(item.media) ? item.media.map(mapMedia) : [],
            severity:  item.severity || undefined,
            resolvedAt:item.resolvedAt ? new Date(item.resolvedAt).toISOString() : undefined,
            resolvedBy:item.resolvedBy ? {
                _id:     (item.resolvedBy as any)?._id?.toString() ?? item.resolvedBy.toString(),
                name:    (item.resolvedBy as any)?.name,
                surname: (item.resolvedBy as any)?.surname,
            } : undefined,
        }));
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function mapUnitRef(unit: any): Inspection["unit"] | undefined {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() || unit.toString(),
        name: unit.name,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType ? {
            _id: unit.unitType._id?.toString() || unit.unitType.toString(),
            name: unit.unitType.name,
            icon: unit.unitType.icon
        } : undefined,
        floor: unit.floor ? {
            _id: unit.floor._id?.toString(),
            name: unit.floor.name,
            edifice: unit.floor.edifice ? {
                _id: unit.floor.edifice._id?.toString(),
                name: unit.floor.edifice.name,
                project: unit.floor.edifice.project ? {
                    _id: unit.floor.edifice.project._id?.toString(),
                    name: unit.floor.edifice.project.name
                } : undefined
            } : undefined
        } : undefined
    };
}

export function inspectionToDTO(inspection: IInspection | any): Inspection {
    return {
        _id: inspection._id.toString(),
        name: inspection.name,
        unit: mapUnitRef(inspection.unit),
        inspectedBy: mapPopulatedSimpleUser(inspection.inspectedBy),
        inspectionDate: inspection.inspectionDate ? new Date(inspection.inspectionDate).toISOString() : new Date().toISOString(),
        scheduledDate: inspection.scheduledDate ? new Date(inspection.scheduledDate).toISOString() : undefined,
        type: inspection.type,
        status: inspection.status,
        notes: inspection.notes || undefined,
        findings: mapFindings(inspection.findings),
        rating: inspection.rating || undefined,
        media: !!inspection.media ? inspection.media?.map(mapMedia) : [],
        nextInspectionDate: inspection.nextInspectionDate ? new Date(inspection.nextInspectionDate).toISOString() : undefined,
        followUpRequired: inspection.followUpRequired || false,
        followUpInspection: mapPopulatedRef(inspection.followUpInspection),
        followedUpByInspection: mapPopulatedRef(inspection.followedUpByInspection),
        followUpRequiredOutstanding: !!(inspection.followUpRequired && !inspection.followUpInspection && !inspection.followedUpByInspection),
        completedAt: inspection.completedAt ? new Date(inspection.completedAt).toISOString() : undefined,
        cancelledAt: inspection.cancelledAt ? new Date(inspection.cancelledAt).toISOString() : undefined,
        cancellationReason: inspection.cancellationReason || undefined,
        createdAt: (inspection as any).createdAt ? new Date((inspection as any).createdAt).toISOString() : undefined,
        updatedAt: (inspection as any).updatedAt ? new Date((inspection as any).updatedAt).toISOString() : undefined,
        ...mapSoftDeleteToDTO(inspection),
        ...mapOwnershipToDTO(inspection)
    };
}

export function inspectionsToDTO(inspections: IInspection[]): Inspection[] {
    return inspections.map(inspectionToDTO);
}
