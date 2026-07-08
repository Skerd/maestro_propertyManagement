import {Schema} from "mongoose";

/**
 * Payment Plan Indexes
 * 
 * Optimized indexes for payment plan queries.
 * Supports queries by sale, status, dates, and installment tracking.
 */
export function applyPaymentPlanIndexes(PaymentPlanSchema: Schema): void {
    // Primary query pattern - payment plans by sale (already unique, but explicit index for clarity)
    PaymentPlanSchema.index({ sale: 1 });
    
    // For filtering by status (already has inline index, but compound for better performance)
    PaymentPlanSchema.index({ status: 1, createdAt: -1 });
    
    // For finding payment plans by start date
    PaymentPlanSchema.index({ startDate: 1 });
    
    // For finding payment plans by end date
    PaymentPlanSchema.index({ endDate: 1 });
    
    // For finding active payment plans
    PaymentPlanSchema.index({ status: 1, startDate: 1 });
    
    // For finding overdue payment plans
    PaymentPlanSchema.index({ status: 1, endDate: 1 });
    
    // Compound index for sale + status queries
    PaymentPlanSchema.index({ sale: 1, status: 1 });
    
    // For date range queries
    PaymentPlanSchema.index({ startDate: 1, endDate: 1 });
    
    // For sorting by creation date
    PaymentPlanSchema.index({ createdAt: -1 });

    // Cron optimization: daily installment reminder job scans for active/overdue plans
    // with upcoming/past-due installments — this compound index avoids collection scans
    PaymentPlanSchema.index({ "installments.dueDate": 1, status: 1 });
}
