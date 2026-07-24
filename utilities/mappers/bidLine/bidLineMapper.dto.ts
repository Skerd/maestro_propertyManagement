import type {BidLine} from "armonia/src/modules/propertyManagement/api/realEstate/private/bidLine/bidLine.dto";
import type {IBidLine} from "../../../database/schemas/bidLine/bidLine";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function bidLineToDTO(doc: IBidLine | any): BidLine {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title ?? undefined,
        alternativeNote: doc.alternativeNote ?? undefined,
        sortIndex: doc.sortIndex ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.bid) out.bid = mapPopulatedRef(doc.bid);
    if (doc.specificationItem) out.specificationItem = mapPopulatedRef(doc.specificationItem);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","alternativeNote","sortIndex","bid","specificationItem","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as BidLine;
}

export function bidLinesToDTO(docs: IBidLine[]): BidLine[] {
    return docs.map(bidLineToDTO);
}
