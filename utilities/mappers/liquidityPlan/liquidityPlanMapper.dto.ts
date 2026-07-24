import type {LiquidityPlan} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/liquidityPlan.dto";
import type {ILiquidityPlan} from "../../../database/schemas/liquidityPlan/liquidityPlan";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function liquidityPlanToDTO(doc: ILiquidityPlan | any): LiquidityPlan {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        granularity: doc.granularity ?? undefined,
        notes: doc.notes ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.currency) out.currency = mapPopulatedRef(doc.currency);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","granularity","notes","project","currency","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as LiquidityPlan;
}

export function liquidityPlansToDTO(docs: ILiquidityPlan[]): LiquidityPlan[] {
    return docs.map(liquidityPlanToDTO);
}
