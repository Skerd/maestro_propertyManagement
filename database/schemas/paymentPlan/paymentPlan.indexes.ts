import {Schema} from "mongoose";

/**
 * Payment Plan Indexes
 * 
 * Optimized indexes for payment plan queries.
 * Supports queries by sale, status, dates, and installment tracking.
 */
export function applyPaymentPlanIndexes(PaymentPlanSchema: Schema): void {
    // sale: `unique` on the field already indexes it; a second declaration of the same key conflicts
    
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

    // The installment reminder and overdue sweeps (DB-06): `{company, status: "active", _id: {$gt}}` sorted by `_id`,
    // paged. Installments are matched after `$unwind` everywhere, so an `installments.dueDate` index serves no query.
    PaymentPlanSchema.index({ company: 1, status: 1, _id: 1 });
}
