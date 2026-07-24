import type {SpecificationItem} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/specificationItem.dto";
import type {ISpecificationItem} from "../../../database/schemas/specificationItem/specificationItem";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function specificationItemToDTO(doc: ISpecificationItem | any): SpecificationItem {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        npkChapter: doc.npkChapter ?? undefined,
        npkPosition: doc.npkPosition ?? undefined,
        isRPosition: doc.isRPosition ?? false,
        description: doc.description ?? undefined,
        unitOfMeasure: doc.unitOfMeasure ?? undefined,
        classificationStandard: doc.classificationStandard ?? undefined,
        classificationCode: doc.classificationCode ?? undefined,
        sortIndex: doc.sortIndex ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.specification) out.specification = mapPopulatedRef(doc.specification);
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","npkChapter","npkPosition","isRPosition","description","unitOfMeasure","classificationStandard","classificationCode","sortIndex","notes","status","specification","project","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as SpecificationItem;
}

export function specificationItemsToDTO(docs: ISpecificationItem[]): SpecificationItem[] {
    return docs.map(specificationItemToDTO);
}
