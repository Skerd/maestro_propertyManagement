/**
 * Reservation Service
 *
 * CRUD service for Reservation model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import Reservation, {IReservation} from './reservation';
import type {ClientSession, FilterQuery} from "mongoose";
import {CONTRACTS_HUB_RESERVATION_POPULATE} from "@propertyManagement/utilities/contractsHub/contractsHubMapper.dto";
import type {ObjectId} from "mongodb";

export class ReservationService extends BaseCrudService<IReservation, typeof Reservation> {
    constructor() {
        super(Reservation, 'Reservation');
    }

    /** Reservations populated for the contracts hub. */
    findForContractsHub(filter: FilterQuery<IReservation>) {
        return this.model.find(filter)
            .populate(CONTRACTS_HUB_RESERVATION_POPULATE)
            .lean();
    }

    /** Reservations of the given units, for each unit's history. */
    findUnitHistoryLean(filter: FilterQuery<IReservation>) {
        return this.model.find(filter).select("unit reservationDate expirationDate cancelledAt expiredAt status name").lean();
    }

    /** The matching reservation, read in the session. */
    findOneInSession(filter: FilterQuery<IReservation>, session: ClientSession | null | undefined) {
        return this.model.findOne(filter).session(session).exec();
    }

    /** The units and clients of the matching reservations, as plain objects. */
    findClientsLean(filter: FilterQuery<IReservation>) {
        return this.model.find(filter)
            .select("unit client")
            .lean<{unit: ObjectId; client: ObjectId}[]>();
    }
}

export const reservationService = new ReservationService();
