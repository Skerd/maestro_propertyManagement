import {Schema} from "mongoose";

/**
 * Payment Plan Indexes
 *
 * Every tenant query carries `company` (ownershipPlugin, DB-02), so each index starts with it (DB-06).
 * sale: `unique` on the field already indexes it; a second declaration of the same key conflicts.
 */
export function applyPaymentPlanIndexes(PaymentPlanSchema: Schema): void {
    // The installment reminder and overdue sweeps: `{company, status: {$in}, _id: {$gt}}` sorted by `_id`, paged.
    // Installments are matched after `$unwind` everywhere, so an `installments.dueDate` index serves no query.
    PaymentPlanSchema.index({ company: 1, status: 1, _id: 1 });

    // Plans by status and plan window (dashboards, the payments hub's `startDate` sort)
    PaymentPlanSchema.index({ company: 1, status: 1, startDate: 1 });
    PaymentPlanSchema.index({ company: 1, status: 1, endDate: 1 });
    PaymentPlanSchema.index({ company: 1, startDate: 1, endDate: 1 });

    // Plans of a set of sales (payments hub scoped by unit, ERP export by project)
    PaymentPlanSchema.index({ company: 1, sale: 1, status: 1 });

    // Newest first
    PaymentPlanSchema.index({ company: 1, createdAt: -1 });
}
