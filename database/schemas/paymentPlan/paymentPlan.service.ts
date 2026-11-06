/**
 * Payment Plan Service
 * 
 * CRUD service for PaymentPlan model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import PaymentPlan, {IPaymentPlan} from './paymentPlan';
import type {FilterQuery, UpdateQuery} from "mongoose";

export class PaymentPlanService extends BaseCrudService<IPaymentPlan, typeof PaymentPlan> {
    constructor() {
        super(PaymentPlan, 'PaymentPlan');
    }

    /** Payment plans with their sale and its currency, for the ERP export. */
    findForErpExport(filter: FilterQuery<IPaymentPlan>) {
        return this.model.find(filter)
            .select("name installments sale")
            .populate({
                path: "sale",
                select: "name saleCurrency",
                populate: {path: "saleCurrency", select: "abbreviation symbol"},
            })
            .lean();
    }

    /** Updates the installments picked by `arrayFilters` (`$[i]` in the update). */
    updateInstallments(filter: FilterQuery<IPaymentPlan>, update: UpdateQuery<IPaymentPlan>, arrayFilters: Record<string, unknown>[]) {
        return this.model.updateOne(filter, update, {arrayFilters});
    }
}

export const paymentPlanService = new PaymentPlanService();
