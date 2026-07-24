import type {Bid} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/bid.dto";
import type {IBid} from "../../../database/schemas/bid/bid";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function bidToDTO(doc: IBid | any): Bid {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        coveringNotes: doc.coveringNotes ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.tender) out.tender = mapPopulatedRef(doc.tender);
    if (doc.tenderInvitation) out.tenderInvitation = mapPopulatedRef(doc.tenderInvitation);
    if (doc.constructorRef) out.constructorRef = mapPopulatedRef(doc.constructorRef);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","coveringNotes","notes","status","tender","tenderInvitation","constructorRef","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as Bid;
}

export function bidsToDTO(docs: IBid[]): Bid[] {
    return docs.map(bidToDTO);
}
