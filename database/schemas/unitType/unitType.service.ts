/**
 * UnitType Service
 *
 * CRUD service for UnitType model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import UnitType, {IUnitType} from './unitType';

export class UnitTypeService extends BaseCrudService<IUnitType, typeof UnitType> {
    constructor() {
        super(UnitType, 'UnitType');
    }
}

export const unitTypeService = new UnitTypeService();
