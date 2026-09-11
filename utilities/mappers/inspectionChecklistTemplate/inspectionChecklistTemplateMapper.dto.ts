import type {InspectionChecklistTemplate, InspectionChecklistTemplateItem} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/inspectionChecklistTemplate.dto";
import type {IInspectionChecklistTemplate} from "../../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapItem(item: {
    _id?: {toString(): string};
    name: string;
    description?: string;
    instructions?: string;
    importance?: InspectionChecklistTemplateItem["importance"];
}): InspectionChecklistTemplateItem {
    return {
        _id: item._id?.toString(),
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance,
    };
}

export function inspectionChecklistTemplateToDTO(doc: IInspectionChecklistTemplate | any): InspectionChecklistTemplate {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const items = Array.isArray(raw.items) ? raw.items.map(mapItem) : [];
    return {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        description: doc.description ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        trade: doc.trade ?? undefined,
        stage: doc.stage ?? undefined,
        items,
        ...mapOwnershipToDTO(doc),
    };
}

export function inspectionChecklistTemplatesToDTO(docs: IInspectionChecklistTemplate[]): InspectionChecklistTemplate[] {
    return docs.map(inspectionChecklistTemplateToDTO);
}
