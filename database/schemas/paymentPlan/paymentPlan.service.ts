/**
 * Payment Plan Service
 * 
 * CRUD service for PaymentPlan model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import PaymentPlan, {IPaymentPlan} from './paymentPlan';

export class PaymentPlanService extends BaseCrudService<IPaymentPlan, typeof PaymentPlan> {
    constructor() {
        super(PaymentPlan, 'PaymentPlan');
    }
}

export const paymentPlanService = new PaymentPlanService();
