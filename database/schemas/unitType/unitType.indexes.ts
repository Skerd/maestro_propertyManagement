import {Schema} from "mongoose";

/**
 * Unit Type Indexes
 * 
 * Optimized indexes for unit type queries.
 * Supports queries by category, group, name, and slug.
 */
export function applyUnitTypeIndexes(UnitTypeSchema: Schema): void {
    // For filtering by category (already has inline index, but compound for better performance)
    UnitTypeSchema.index({ category: 1, createdAt: -1 });
    
    // For filtering by group (already has inline index, but compound for better performance)
    UnitTypeSchema.index({ group: 1, createdAt: -1 });
    
    // Names and slugs are unique per company (types are seeded per company)
    UnitTypeSchema.index({ company: 1, name: 1 }, { unique: true });
    
    UnitTypeSchema.index({ company: 1, slug: 1 }, { unique: true });
    
    // Compound index for category + group queries
    UnitTypeSchema.index({ category: 1, group: 1 });
    
    // For filtering by privacy status
    UnitTypeSchema.index({ isPrivate: 1 });
    
    // Compound index for category + privacy queries
    UnitTypeSchema.index({ category: 1, isPrivate: 1 });
}
