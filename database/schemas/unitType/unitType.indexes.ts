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
    
    // For finding unit types by name (already unique, but explicit index for clarity)
    UnitTypeSchema.index({ name: 1 });
    
    // For finding unit types by slug (already unique, but explicit index for clarity)
    UnitTypeSchema.index({ slug: 1 });
    
    // Compound index for category + group queries
    UnitTypeSchema.index({ category: 1, group: 1 });
    
    // For filtering by privacy status
    UnitTypeSchema.index({ isPrivate: 1 });
    
    // Compound index for category + privacy queries
    UnitTypeSchema.index({ category: 1, isPrivate: 1 });
}
