/**
 * Reservation Service
 *
 * CRUD service for Reservation model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import Reservation, {IReservation} from './reservation';

export class ReservationService extends BaseCrudService<IReservation, typeof Reservation> {
    constructor() {
        super(Reservation, 'Reservation');
    }
}

export const reservationService = new ReservationService();
