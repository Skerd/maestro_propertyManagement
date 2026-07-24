import type {InspectionChecklistTemplate} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/inspectionChecklistTemplate.dto";
import type {IInspectionChecklistTemplate} from "../../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function inspectionChecklistTemplateToDTO(doc: IInspectionChecklistTemplate | any): InspectionChecklistTemplate {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        description: doc.description ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    if (doc.media?.length) out.media = doc.media.map(mapMedia);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","description","notes","status","project","edifice","media","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as InspectionChecklistTemplate;
}

export function inspectionChecklistTemplatesToDTO(docs: IInspectionChecklistTemplate[]): InspectionChecklistTemplate[] {
    return docs.map(inspectionChecklistTemplateToDTO);
}
