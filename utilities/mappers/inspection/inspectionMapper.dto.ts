import {IInspection, IInspectionChecklistItem} from "../../../database/schemas/inspection/inspection";
import {Inspection, InspectionChecklistItem, InspectionFindings} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {InspectionChecklistTemplateSimple} from "armonia/src/modules/propertyManagement/dto/inspectionChecklistTemplate.dto";
import type {InspectionSimple} from "armonia/src/modules/propertyManagement/dto/inspection.dto";
import type {UnitWithFloor} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {InspectionChecklistTemplateSimpleSnippet} from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate.snippets";
import {InspectionSimpleSnippet} from "@propertyManagement/database/schemas/inspection/inspection.snippets";
import {UnitSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {isInspectionChecklistComplete} from "../../inspectionChecklist/inspectionChecklist.sync";

const FINDINGS_KEYS = [
    "structuralIssues", "electricalIssues", "plumbingIssues", "hvacIssues",
    "safetyConcerns", "cosmeticIssues", "otherObservations",
] as const;

function mapFindings(findings: Record<string, unknown> | null | undefined): InspectionFindings | undefined {
    if (!findings || typeof findings !== "object") return undefined;
    const result: InspectionFindings = {};
    for (const key of FINDINGS_KEYS) {
        const items = findings[key];
        if (!Array.isArray(items) || items.length === 0) continue;
        result[key] = items.map((item: {
            notes: string;
            media?: unknown[];
            severity?: string;
            resolvedAt?: Date | string;
            resolvedBy?: object;
        }) => ({
            notes:     item.notes,
            media:     Array.isArray(item.media) ? item.media.map(mapMedia) : [],
            severity:  item.severity || undefined,
            resolvedAt:item.resolvedAt ? new Date(item.resolvedAt).toISOString() : undefined,
            resolvedBy: mapSnippet<SimpleBlankUser>()(item.resolvedBy, SimpleBlankUserSnippet),
        }));
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function mapChecklistItem(item: IInspectionChecklistItem): InspectionChecklistItem {
    return {
        _id: item._id != null ? String(item._id) : undefined,
        sourceTemplateId: item.sourceTemplateId != null ? String(item.sourceTemplateId) : undefined,
        sourceItemId: item.sourceItemId != null ? String(item.sourceItemId) : undefined,
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance as InspectionChecklistItem["importance"],
        completed: !!item.completed,
        completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : undefined,
        completedBy: mapSnippet<SimpleBlankUser>()(item.completedBy, SimpleBlankUserSnippet),
        retained: !!item.retained,
    };
}

export function inspectionToDTO(inspection: IInspection): Inspection {
    return {
        _id: inspection._id.toString(),
        name: inspection.name,
        unit: mapSnippet<UnitWithFloor>()(inspection.unit, UnitSnippet)!,
        inspectedBy: mapSnippet<SimpleBlankUser>()(inspection.inspectedBy, SimpleBlankUserSnippet)!,
        inspectionDate: inspection.inspectionDate ? new Date(inspection.inspectionDate).toISOString() : new Date().toISOString(),
        scheduledDate: inspection.scheduledDate ? new Date(inspection.scheduledDate).toISOString() : undefined,
        type: inspection.type,
        status: inspection.status,
        notes: inspection.notes || undefined,
        findings: mapFindings(inspection.findings as Record<string, unknown> | undefined),
        rating: inspection.rating || undefined,
        media: !!inspection.media ? inspection.media?.map(mapMedia) : [],
        nextInspectionDate: inspection.nextInspectionDate ? new Date(inspection.nextInspectionDate).toISOString() : undefined,
        followUpRequired: inspection.followUpRequired || false,
        followUpInspection: mapSnippet<InspectionSimple>()(inspection.followUpInspection, InspectionSimpleSnippet),
        followedUpByInspection: mapSnippet<InspectionSimple>()(inspection.followedUpByInspection, InspectionSimpleSnippet),
        followUpRequiredOutstanding: !!(inspection.followUpRequired && !inspection.followUpInspection && !inspection.followedUpByInspection),
        completedAt: inspection.completedAt ? new Date(inspection.completedAt).toISOString() : undefined,
        cancelledAt: inspection.cancelledAt ? new Date(inspection.cancelledAt).toISOString() : undefined,
        cancellationReason: inspection.cancellationReason || undefined,
        checklistTemplate: mapSnippet<InspectionChecklistTemplateSimple>()(
            inspection.checklistTemplate,
            InspectionChecklistTemplateSimpleSnippet,
        ),
        checklistItems: Array.isArray(inspection.checklistItems)
            ? inspection.checklistItems.map(mapChecklistItem)
            : [],
        checklistComplete: isInspectionChecklistComplete(inspection.checklistItems ?? []),
        ...mapSoftDeleteToDTO(inspection),
        ...mapOwnershipToDTO(inspection)
    };
}

export function inspectionsToDTO(inspections: IInspection[]): Inspection[] {
    return inspections.map(inspectionToDTO);
}
