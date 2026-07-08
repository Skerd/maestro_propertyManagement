import {Schema} from "mongoose";

export function applyUnitTypeCategoryIndexes(UnitTypeCategorySchema: Schema): void {
    UnitTypeCategorySchema.index({company: 1, createdAt: -1});
    UnitTypeCategorySchema.index({company: 1, name: 1}, {unique: true});
    UnitTypeCategorySchema.index({name: 1});
}
