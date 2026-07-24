import type {LiquidityLine} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityLine/liquidityLine.dto";
import type {ILiquidityLine} from "../../../database/schemas/liquidityLine/liquidityLine";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function liquidityLineToDTO(doc: ILiquidityLine | any): LiquidityLine {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        direction: doc.direction,
        source: doc.source ?? undefined,
        title: doc.title ?? undefined,
        notes: doc.notes ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.plan) out.plan = mapPopulatedRef(doc.plan);
    if (doc.currency) out.currency = mapPopulatedRef(doc.currency);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","direction","source","title","notes","plan","currency","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as LiquidityLine;
}

export function liquidityLinesToDTO(docs: ILiquidityLine[]): LiquidityLine[] {
    return docs.map(liquidityLineToDTO);
}
