import {Schema} from "mongoose";
import {IIncomingInvoice} from "./incomingInvoice";

export function applyIncomingInvoiceIndexes(schema: Schema<IIncomingInvoice>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({company: 1, status: 1});
    schema.index({ocrStatus: 1});
    schema.index({matchedConstructor: 1}, {sparse: true});
}
