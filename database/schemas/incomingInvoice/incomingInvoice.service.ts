import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import IncomingInvoice, {IIncomingInvoice} from "./incomingInvoice";

export class IncomingInvoiceService extends BaseCrudService<IIncomingInvoice, typeof IncomingInvoice> {
    constructor() {
        super(IncomingInvoice, "IncomingInvoice");
    }
}

export const incomingInvoiceService = new IncomingInvoiceService();
