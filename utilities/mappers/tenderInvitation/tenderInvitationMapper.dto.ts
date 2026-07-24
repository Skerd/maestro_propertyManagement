import type {TenderInvitation} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/tenderInvitation.dto";
import type {ITenderInvitation} from "../../../database/schemas/tenderInvitation/tenderInvitation";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function tenderInvitationToDTO(doc: ITenderInvitation | any): TenderInvitation {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        portalAccessToken: doc.portalAccessToken ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.tender) out.tender = mapPopulatedRef(doc.tender);
    if (doc.constructorRef) out.constructorRef = mapPopulatedRef(doc.constructorRef);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","portalAccessToken","notes","status","tender","constructorRef","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as TenderInvitation;
}

export function tenderInvitationsToDTO(docs: ITenderInvitation[]): TenderInvitation[] {
    return docs.map(tenderInvitationToDTO);
}
