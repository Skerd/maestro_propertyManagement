import type {CostClassification} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/costClassification.dto";
import type {ICostClassification} from "../../../database/schemas/costClassification/costClassification";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function costClassificationToDTO(doc: ICostClassification | any): CostClassification {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        standard: doc.standard,
        code: doc.code,
        parentCode: doc.parentCode ?? undefined,
        level: doc.level ?? undefined,
        title: doc.title,
        unitOfMeasure: doc.unitOfMeasure ?? undefined,
        sortIndex: doc.sortIndex ?? undefined,
        active: doc.active,
        notes: doc.notes ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","standard","code","parentCode","level","title","unitOfMeasure","sortIndex","active","notes","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as CostClassification;
}

export function costClassificationsToDTO(docs: ICostClassification[]): CostClassification[] {
    return docs.map(costClassificationToDTO);
}
