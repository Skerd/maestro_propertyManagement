import {Schema} from "mongoose";

/**
 * Reservation Indexes
 *
 * Optimized indexes for reservation queries.
 * Supports queries by unit, client, company, and reservation status.
 */
export function applyReservationIndexes(ReservationSchema: Schema): void {
    // Primary query pattern - reservations by unit
    ReservationSchema.index({ unit: 1, createdAt: -1 });

    // For finding reservations by client
    ReservationSchema.index({ client: 1, createdAt: -1 });

    // For finding reservations by company
    ReservationSchema.index({ reservedByCompany: 1, createdAt: -1 });

    // For finding reservations by user who made the reservation
    ReservationSchema.index({ reservedBy: 1, createdAt: -1 });

    // For filtering active reservations
    ReservationSchema.index({ isActive: 1, createdAt: -1 });

    // For filtering paid reservations
    ReservationSchema.index({ paid: 1, createdAt: -1 });

    // For finding reservations by reservation date
    ReservationSchema.index({ reservationDate: -1 });

    // For finding reservations by expiration date
    ReservationSchema.index({ expirationDate: 1 });

    // Compound indexes for common query patterns
    ReservationSchema.index({ unit: 1, isActive: 1 });
    ReservationSchema.index({ client: 1, isActive: 1 });
    ReservationSchema.index({ reservedByCompany: 1, isActive: 1 });
    ReservationSchema.index({ isActive: 1, paid: 1 });

    // For finding cancelled reservations
    ReservationSchema.index({ cancelledAt: -1 });

    // Compound index for unit + active status (most common query)
    ReservationSchema.index({ unit: 1, isActive: 1, createdAt: -1 });

    // Compound index for expiration job: stamp expiredAt for unpaid actives
    ReservationSchema.index({ isActive: 1, paid: 1, expirationDate: 1, expiredAt: 1 });

    // Multi-company: client reservations filtered to a specific company
    ReservationSchema.index({ client: 1, company: 1 });
}
