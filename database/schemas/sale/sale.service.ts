/**
 * Sale Service
 * 
 * CRUD service for Sale model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import Sale, {ISale} from './sale';

export class SaleService extends BaseCrudService<ISale, typeof Sale> {
    constructor() {
        super(Sale, 'Sale');
    }
}

export const saleService = new SaleService();
