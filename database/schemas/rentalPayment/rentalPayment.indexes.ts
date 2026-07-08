import {Schema} from "mongoose";

export function applyRentalPaymentIndexes(RentalPaymentSchema: Schema): void {
    RentalPaymentSchema.index({company: 1, lease:   1, dueDate: -1});
    RentalPaymentSchema.index({company: 1, unit:    1, status: 1});
    RentalPaymentSchema.index({company: 1, status:  1, dueDate: 1});
}
