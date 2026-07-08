import {Schema} from "mongoose";

export function applyUnitCostIndexes(UnitCostSchema: Schema): void {
    UnitCostSchema.index({name: 1}, {unique: true});
    UnitCostSchema.index({company: 1, unit: 1, purchaseDate: -1});
    UnitCostSchema.index({company: 1, floor: 1, purchaseDate: -1});
    UnitCostSchema.index({company: 1, edifice: 1, purchaseDate: -1});
    UnitCostSchema.index({company: 1, project: 1, purchaseDate: -1});
    UnitCostSchema.index({company: 1, verificationStatus: 1});
    UnitCostSchema.index({company: 1, paymentStatus: 1});
    UnitCostSchema.index({company: 1, tag: 1});
}
