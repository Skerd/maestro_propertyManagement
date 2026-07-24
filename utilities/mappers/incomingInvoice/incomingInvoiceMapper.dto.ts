import type {IncomingInvoice} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/incomingInvoice.dto";
import type {IIncomingInvoice} from "../../../database/schemas/incomingInvoice/incomingInvoice";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

export function incomingInvoiceToDTO(doc: IIncomingInvoice | any): IncomingInvoice {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const kept = ["_id","name","title","extractedSupplierName","extractedIban","extractedCurrencyCode","extractedInvoiceNumber","extractedQrReference","bkpAccountCode","ocrStatus","notes","status","project","matchedConstructor","matchedContract","currency","createdContractorInvoice","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"];
    const out: any = {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title ?? undefined,
        extractedSupplierName: doc.extractedSupplierName ?? undefined,
        extractedIban: doc.extractedIban ?? undefined,
        extractedCurrencyCode: doc.extractedCurrencyCode ?? undefined,
        extractedInvoiceNumber: doc.extractedInvoiceNumber ?? undefined,
        extractedQrReference: doc.extractedQrReference ?? undefined,
        bkpAccountCode: doc.bkpAccountCode ?? undefined,
        ocrStatus: doc.ocrStatus,
        notes: doc.notes ?? undefined,
        status: doc.status,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.matchedConstructor) out.matchedConstructor = mapPopulatedRef(doc.matchedConstructor);
    if (doc.matchedContract) out.matchedContract = mapPopulatedRef(doc.matchedContract);
    if (doc.currency) out.currency = mapPopulatedRef(doc.currency);
    if (doc.createdContractorInvoice) out.createdContractorInvoice = mapPopulatedRef(doc.createdContractorInvoice);
    for (const [k, v] of Object.entries(raw)) {
        if (kept.includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as IncomingInvoice;
}

export function incomingInvoicesToDTO(docs: IIncomingInvoice[]): IncomingInvoice[] {
    return docs.map(incomingInvoiceToDTO);
}
