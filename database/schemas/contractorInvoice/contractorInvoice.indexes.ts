import {Schema} from "mongoose";
import {IContractorInvoice} from "./contractorInvoice";

export function applyContractorInvoiceIndexes(schema: Schema<IContractorInvoice>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({project: 1, status: 1}, {sparse: true});
    schema.index({constructorRef: 1, status: 1}, {sparse: true});
    schema.index({bkpAccountCode: 1}, {sparse: true});
}
