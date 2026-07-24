import type {Specification} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/specification.dto";
import type {ISpecification} from "../../../database/schemas/specification/specification";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function specificationToDTO(doc: ISpecification | any): Specification {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        standard: doc.standard ?? undefined,
        description: doc.description ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    if (doc.workPackage) out.workPackage = mapPopulatedRef(doc.workPackage);
    if (doc.media?.length) out.media = doc.media.map(mapMedia);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","standard","description","notes","status","project","edifice","workPackage","media","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as Specification;
}

export function specificationsToDTO(docs: ISpecification[]): Specification[] {
    return docs.map(specificationToDTO);
}
