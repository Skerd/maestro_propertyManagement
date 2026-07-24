import type {ApprovalWorkflow} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalWorkflow/approvalWorkflow.dto";
import type {IApprovalWorkflow} from "../../../database/schemas/approvalWorkflow/approvalWorkflow";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function approvalWorkflowToDTO(doc: IApprovalWorkflow | any): ApprovalWorkflow {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        documentType: doc.documentType,
        title: doc.title,
        approverRole: doc.approverRole ?? undefined,
        escalationRole: doc.escalationRole ?? undefined,
        active: doc.active,
        notes: doc.notes ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.thresholdCurrency) out.thresholdCurrency = mapPopulatedRef(doc.thresholdCurrency);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","documentType","title","approverRole","escalationRole","active","notes","thresholdCurrency","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as ApprovalWorkflow;
}

export function approvalWorkflowsToDTO(docs: IApprovalWorkflow[]): ApprovalWorkflow[] {
    return docs.map(approvalWorkflowToDTO);
}
