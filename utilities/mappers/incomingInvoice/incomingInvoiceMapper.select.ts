import type {IIncomingInvoice} from "../../../database/schemas/incomingInvoice/incomingInvoice";

export function incomingInvoicesToSelect(docs: IIncomingInvoice[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
