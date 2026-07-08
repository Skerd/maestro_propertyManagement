import {Schema} from "mongoose";

/**
 * Real Estate Floor Indexes
 * 
 * Optimized indexes for high-performance queries on floor collections.
 * Critical for aggregation pipelines that count floors per project.
 */
export function applyFloorIndexes(FloorSchema: Schema): void {
    // Primary query pattern - floors by edifice (used in aggregations)
    FloorSchema.index({ edifice: 1 });
    
    // Compound index for edifice + company queries
    FloorSchema.index({ company: 1, edifice: 1 });
    
    // For sorting by creation date
    FloorSchema.index({ createdAt: -1 });
}

