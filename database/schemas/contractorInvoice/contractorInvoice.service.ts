import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ContractorInvoice, {IContractorInvoice} from "./contractorInvoice";

export class ContractorInvoiceService extends BaseCrudService<IContractorInvoice, typeof ContractorInvoice> {
    constructor() {
        super(ContractorInvoice, "ContractorInvoice");
    }
}

export const contractorInvoiceService = new ContractorInvoiceService();
