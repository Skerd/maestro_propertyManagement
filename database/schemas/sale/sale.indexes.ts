import {Schema} from "mongoose";

/**
 * Sale Indexes
 *
 * Every tenant query carries `company` (ownershipPlugin, DB-02), so each index starts with it (DB-06).
 */
export function applySaleIndexes(SaleSchema: Schema): void {
    // Sales of a unit (unit pages, hubs scoped by unit), by payment type and newest sale day
    SaleSchema.index({ company: 1, unit: 1, paymentType: 1, saleDate: -1 });

    // Sales by payment type
    SaleSchema.index({ company: 1, paymentType: 1, saleDate: -1 });

    // Sales by seller (agent report), by payment type
    SaleSchema.index({ company: 1, soldBy: 1, paymentType: 1, createdAt: -1 });

    // Sales by payment plan, buyer and buyer company
    SaleSchema.index({ company: 1, paymentPlan: 1 });
    SaleSchema.index({ company: 1, buyer: 1 });
    SaleSchema.index({ company: 1, buyerCompany: 1 });

    // The agent report's created-day window
    SaleSchema.index({ company: 1, createdAt: -1 });

    // The sale a reservation became, and sales by approval state
    SaleSchema.index({ company: 1, reservation: 1 });
    SaleSchema.index({ company: 1, approvalStatus: 1, saleDate: -1 });

    // The sales list: `{company}` sorted by `saleDate: -1` (the router's default sort).
    SaleSchema.index({ company: 1, saleDate: -1 });
}
