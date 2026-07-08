/**
 * Modification Request Service
 * 
 * CRUD service for ModificationRequest model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import ModificationRequest, {IModificationRequest} from './modificationRequest';

export class ModificationRequestService extends BaseCrudService<IModificationRequest, typeof ModificationRequest> {
    constructor() {
        super(ModificationRequest, 'ModificationRequest');
    }
}

export const modificationRequestService = new ModificationRequestService();
