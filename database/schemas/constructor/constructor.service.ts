/**
 * Constructor Service
 *
 * CRUD service for Constructor model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import Constructor, {IConstructor} from './constructor';

export class ConstructorService extends BaseCrudService<IConstructor, typeof Constructor> {
    constructor() {
        super(Constructor, 'Constructor');
    }
}

export const constructorService = new ConstructorService();
