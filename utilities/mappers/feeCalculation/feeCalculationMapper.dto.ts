import type {FeeCalculation} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/feeCalculation.dto";
import type {IFeeCalculation} from "../../../database/schemas/feeCalculation/feeCalculation";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function feeCalculationToDTO(doc: IFeeCalculation | any): FeeCalculation {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        feePercent: doc.feePercent ?? undefined,
        adjustmentFactor: doc.adjustmentFactor ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.consultantAppointment) out.consultantAppointment = mapPopulatedRef(doc.consultantAppointment);
    if (doc.currency) out.currency = mapPopulatedRef(doc.currency);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","feePercent","adjustmentFactor","notes","status","consultantAppointment","currency","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as FeeCalculation;
}

export function feeCalculationsToDTO(docs: IFeeCalculation[]): FeeCalculation[] {
    return docs.map(feeCalculationToDTO);
}
