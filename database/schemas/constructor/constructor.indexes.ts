import {Schema} from "mongoose";

/**
 * Optimized indexes for constructor queries.
 * Supports queries by company, VAT, name, and email.
 */
export function applyConstructorIndexes(ConstructorSchema: Schema): void {
    ConstructorSchema.index({ company: 1, createdAt: -1 });
    ConstructorSchema.index({ vat: 1 });
    ConstructorSchema.index({ name: 1 });
    ConstructorSchema.index({ email: 1 });
    ConstructorSchema.index({ company: 1, name: 1 });
    ConstructorSchema.index({ createdAt: -1 });
}
