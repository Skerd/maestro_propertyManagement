import {Schema} from "mongoose";

/**
 * Reservation Indexes
 *
 * Every tenant query carries `company` (ownershipPlugin, DB-02), so each index starts with it (DB-06).
 */
export function applyReservationIndexes(ReservationSchema: Schema): void {
    // Reservations of a unit, the active one first (unit pages, sale creation, conflicts)
    ReservationSchema.index({ company: 1, unit: 1, isActive: 1, createdAt: -1 });

    // Reservations of a client
    ReservationSchema.index({ company: 1, client: 1, isActive: 1, createdAt: -1 });

    // Reservations by the reserving company and by the agent who made them (agent report)
    ReservationSchema.index({ company: 1, reservedByCompany: 1, isActive: 1, createdAt: -1 });
    ReservationSchema.index({ company: 1, reservedBy: 1, createdAt: -1 });

    // Active / paid filters on the list, newest first
    ReservationSchema.index({ company: 1, isActive: 1, createdAt: -1 });
    ReservationSchema.index({ company: 1, paid: 1, createdAt: -1 });

    // Reservations by status and by source
    ReservationSchema.index({ company: 1, status: 1, createdAt: -1 });
    ReservationSchema.index({ company: 1, source: 1 });

    // Expiration and cancellation days
    ReservationSchema.index({ company: 1, expirationDate: 1 });
    ReservationSchema.index({ company: 1, cancelledAt: -1 });

    // Unpaid active reservations by expiration day: the expiry cron
    // `{company, isActive: true, paid: false, status: "active", expirationDate: {$lt}}`, the reminder cron
    // `{company, isActive: true, paid: false, expirationDate: "<day>"}` and the dashboard's upcoming expirations
    // (expiration days are `YYYY-MM-DD` strings, D115).
    ReservationSchema.index({ company: 1, isActive: 1, paid: 1, status: 1, expirationDate: 1 });

    // The reservations list: `{company}` sorted by `reservationDate: -1` (the router's default sort).
    ReservationSchema.index({ company: 1, reservationDate: -1 });

    // A client's own reservations across companies, then narrowed to one
    ReservationSchema.index({ client: 1, company: 1 });
}
