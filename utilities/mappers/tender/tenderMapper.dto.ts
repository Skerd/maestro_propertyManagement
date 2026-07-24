import type {Tender} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/tender.dto";
import type {ITender} from "../../../database/schemas/tender/tender";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function tenderToDTO(doc: ITender | any): Tender {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        trades: Array.isArray(doc.trades) ? doc.trades : undefined,
        description: doc.description ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    if (doc.specification) out.specification = mapPopulatedRef(doc.specification);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","trades","description","notes","status","project","edifice","specification","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as Tender;
}

export function tendersToDTO(docs: ITender[]): Tender[] {
    return docs.map(tenderToDTO);
}
