import {Schema} from "mongoose";

/**
 * Unit Indexes
 * 
 * Optimized indexes for unit queries.
 * Supports queries by project, edifice, floor, status, type, and various filters.
 */
export function applyUnitIndexes(UnitSchema: Schema): void {
    // Primary query pattern - units by project
    UnitSchema.index({ project: 1, createdAt: -1 });
    
    // For finding units by edifice
    UnitSchema.index({ edifice: 1, createdAt: -1 });
    
    // For finding units by floor
    UnitSchema.index({ floor: 1, createdAt: -1 });
    
    // For filtering by status (already has inline index, but compound for better performance)
    UnitSchema.index({ status: 1, createdAt: -1 });
    
    // For finding units by type
    UnitSchema.index({ unitType: 1, createdAt: -1 });
    
    // For finding units by company
    UnitSchema.index({ company: 1, createdAt: -1 });
    
    // For finding units by unit number
    UnitSchema.index({ unitNumber: 1 });
    
    // Compound indexes for common query patterns
    UnitSchema.index({ project: 1, status: 1, createdAt: -1 });
    UnitSchema.index({ edifice: 1, status: 1, createdAt: -1 });
    UnitSchema.index({ floor: 1, status: 1, createdAt: -1 });
    UnitSchema.index({ project: 1, unitType: 1, createdAt: -1 });
    UnitSchema.index({ company: 1, status: 1, createdAt: -1 });
    
    // For reservation queries
    UnitSchema.index({ reservation: 1 });
    
    // For sale queries
    UnitSchema.index({ sale: 1 });
    
    // For status + reservation compound queries
    UnitSchema.index({ status: 1, reservation: 1 });
    
    // For status + sale compound queries
    UnitSchema.index({ status: 1, sale: 1 });
    
    // For feature-based filtering
    UnitSchema.index({ hasBalcony: 1, hasTerrace: 1 });
    UnitSchema.index({ hasSeaView: 1, hasCityView: 1 });
    UnitSchema.index({ hasElevator: 1 });
    
    // For price range queries
    UnitSchema.index({ price: 1 });
    UnitSchema.index({ priceCurrency: 1, price: 1 });
    
    // For area-based queries
    UnitSchema.index({ area: 1 });
    UnitSchema.index({ netArea: 1 });
    
    // For room-based filtering
    UnitSchema.index({ numberOfRooms: 1 });
    UnitSchema.index({ numberOfBathrooms: 1 });
    
    // Compound index for project + status (most common query)
    UnitSchema.index({ project: 1, status: 1 });
    
    // Compound index for company + status
    UnitSchema.index({ company: 1, status: 1 });
}
