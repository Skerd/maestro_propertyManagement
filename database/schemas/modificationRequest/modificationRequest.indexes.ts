import {Schema} from "mongoose";

/**
 * Modification Request Indexes
 * 
 * Optimized indexes for modification request queries.
 * Supports queries by unit, requester, status, and construction type.
 */
export function applyModificationRequestIndexes(ModificationRequestSchema: Schema): void {
    // Primary query pattern - modification requests by unit
    ModificationRequestSchema.index({ unit: 1, createdAt: -1 });
    
    // For finding requests by requester
    ModificationRequestSchema.index({ requestedBy: 1, createdAt: -1 });
    
    // For filtering by status (already has inline index, but compound for better performance)
    ModificationRequestSchema.index({ status: 1, createdAt: -1 });
    
    // For filtering by construction type (already has inline index, but compound for better performance)
    ModificationRequestSchema.index({ constructionType: 1, createdAt: -1 });
    
    // Compound indexes for common query patterns
    ModificationRequestSchema.index({ unit: 1, status: 1, createdAt: -1 });
    ModificationRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
    ModificationRequestSchema.index({ status: 1, constructionType: 1, createdAt: -1 });
    
    // For notification tracking queries
    ModificationRequestSchema.index({ notificationSent: 1, status: 1 });
    
    // For finding requests by submission date
    ModificationRequestSchema.index({ submittedAt: -1 });
    
    // For finding completed requests
    ModificationRequestSchema.index({ completedAt: -1 });
    
    // For finding cancelled requests
    ModificationRequestSchema.index({ cancelledAt: -1 });
    
    // Compound index for unit + status queries (most common)
    ModificationRequestSchema.index({ unit: 1, status: 1 });

    // Multi-company: unit+status scoped to company for dashboard/reporting
    ModificationRequestSchema.index({ unit: 1, status: 1, company: 1 });
}
