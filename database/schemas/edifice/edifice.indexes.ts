import {Schema} from "mongoose";

/**
 * Real Estate Edifice Indexes
 * 
 * Optimized indexes for high-performance queries on edifice collections.
 * Critical for aggregation pipelines that group by project.
 */
export function applyEdificeIndexes(EdificeSchema: Schema): void {
    // Primary query pattern - edifices by project (used in aggregations)
    EdificeSchema.index({ project: 1 });
    
    // Compound index for project + company queries
    EdificeSchema.index({ company: 1, project: 1 });
    
    // For sorting by creation date
    EdificeSchema.index({ createdAt: -1 });
}

