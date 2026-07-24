import type {ApprovalRequest} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/approvalRequest.dto";
import type {IApprovalRequest} from "../../../database/schemas/approvalRequest/approvalRequest";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function approvalRequestToDTO(doc: IApprovalRequest | any): ApprovalRequest {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        documentType: doc.documentType,
        targetType: doc.targetType,
        targetId: doc.targetId ? String(doc.targetId) : undefined,
        currentStage: doc.currentStage,
        primaryDecision: doc.primaryDecision,
        escalationDecision: doc.escalationDecision,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.workflow) out.workflow = mapPopulatedRef(doc.workflow);
    if (doc.currency) out.currency = mapPopulatedRef(doc.currency);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","documentType","targetType","targetId","currentStage","primaryDecision","escalationDecision","notes","status","workflow","currency","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as ApprovalRequest;
}

export function approvalRequestsToDTO(docs: IApprovalRequest[]): ApprovalRequest[] {
    return docs.map(approvalRequestToDTO);
}
