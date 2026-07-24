import type {ContractorInvoice} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/contractorInvoice.dto";
import type {IContractorInvoice} from "../../../database/schemas/contractorInvoice/contractorInvoice";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function contractorInvoiceToDTO(doc: IContractorInvoice | any): ContractorInvoice {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        invoiceNumber: doc.invoiceNumber ?? undefined,
        bkpAccountCode: doc.bkpAccountCode ?? undefined,
        qrBillReference: doc.qrBillReference ?? undefined,
        source: doc.source ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    if (doc.constructorRef) out.constructorRef = mapPopulatedRef(doc.constructorRef);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","invoiceNumber","bkpAccountCode","qrBillReference","source","notes","status","project","edifice","constructorRef","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as ContractorInvoice;
}

export function contractorInvoicesToDTO(docs: IContractorInvoice[]): ContractorInvoice[] {
    return docs.map(contractorInvoiceToDTO);
}
