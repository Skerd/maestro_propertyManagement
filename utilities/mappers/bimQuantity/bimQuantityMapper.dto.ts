import type {BimQuantity} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimQuantity/bimQuantity.dto";
import type {IBimQuantity} from "../../../database/schemas/bimQuantity/bimQuantity";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
export function bimQuantityToDTO(doc: IBimQuantity | any): BimQuantity {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {_id: doc._id.toString(), name: doc.name, ifcElementType: doc.ifcElementType ?? undefined, classificationCode: doc.classificationCode ?? undefined, unitOfMeasure: doc.unitOfMeasure ?? undefined, notes: doc.notes ?? undefined, ...mapOwnershipToDTO(doc)};
    if (doc.bimModel) out.bimModel = mapPopulatedRef(doc.bimModel);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","ifcElementType","classificationCode","unitOfMeasure","notes","bimModel","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as BimQuantity;
}
export function bimQuantitiesToDTO(docs: IBimQuantity[]): BimQuantity[] { return docs.map(bimQuantityToDTO); }
