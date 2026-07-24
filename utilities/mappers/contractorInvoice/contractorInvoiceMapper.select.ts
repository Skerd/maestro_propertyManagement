import type {IContractorInvoice} from "../../../database/schemas/contractorInvoice/contractorInvoice";

export function contractorInvoicesToSelect(docs: IContractorInvoice[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.invoiceNumber ?? doc.name,
    }));
}
