import {Schema} from "mongoose";

/**
 * Sale Indexes
 * 
 * Optimized indexes for sale queries.
 * Supports queries by unit, payment type, buyer, and sale date.
 */
export function applySaleIndexes(SaleSchema: Schema): void {
    // Primary query pattern - sales by unit (already unique, but explicit index for clarity)
    SaleSchema.index({ unit: 1 });
    
    // For filtering by payment type (already has inline index, but compound for better performance)
    SaleSchema.index({ paymentType: 1, createdAt: -1 });
    
    // For finding sales by seller
    SaleSchema.index({ soldBy: 1, createdAt: -1 });
    
    // For finding sales by sale date (already has inline index, but compound for better performance)
    SaleSchema.index({ saleDate: -1 });
    
    // Compound indexes for common query patterns
    SaleSchema.index({ unit: 1, paymentType: 1 });
    SaleSchema.index({ soldBy: 1, paymentType: 1 });
    SaleSchema.index({ paymentType: 1, saleDate: -1 });
    
    // For finding sales by payment plan reference
    SaleSchema.index({ paymentPlan: 1 });
    
    // For finding sales by buyer (shared for cash and payment plan)
    SaleSchema.index({ buyer: 1 });
    
    // For finding sales by buyer company
    SaleSchema.index({ buyerCompany: 1 });
    
    // Compound index for unit + payment type (most common query)
    SaleSchema.index({ unit: 1, paymentType: 1, saleDate: -1 });
    
    // For sorting by creation date
    SaleSchema.index({ createdAt: -1 });
}
