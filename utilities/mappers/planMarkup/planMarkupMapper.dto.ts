import type {PlanMarkup} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/planMarkup.dto";
import type {IPlanMarkup} from "../../../database/schemas/planMarkup/planMarkup";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function planMarkupToDTO(doc: IPlanMarkup | any): PlanMarkup {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        markerType: doc.markerType,
        layer: doc.layer ?? undefined,
        description: doc.description ?? undefined,
        createdOnSite: doc.createdOnSite ?? false,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.planDocument) out.planDocument = mapPopulatedRef(doc.planDocument);
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.media?.length) out.media = doc.media.map(mapMedia);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","markerType","layer","description","createdOnSite","notes","status","planDocument","project","media","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as PlanMarkup;
}

export function planMarkupsToDTO(docs: IPlanMarkup[]): PlanMarkup[] {
    return docs.map(planMarkupToDTO);
}
