import {Schema} from "mongoose";

/**
 * Unit Indexes
 *
 * Every tenant query carries `company` (ownershipPlugin, DB-02), so each index starts with it (DB-06).
 * reservation, sale: `unique` + `sparse` on the fields already index them; a second declaration conflicts.
 */
export function applyUnitIndexes(UnitSchema: Schema): void {
    // The units list, newest first, and by status
    UnitSchema.index({ company: 1, createdAt: -1 });
    UnitSchema.index({ company: 1, status: 1, createdAt: -1 });

    // The units list filtered by project / edifice / floor (and status), sorted by `createdAt: -1`, and the project
    // statistics `{company, project}` grouped by status.
    UnitSchema.index({ company: 1, project: 1, status: 1, createdAt: -1 });
    UnitSchema.index({ company: 1, edifice: 1, status: 1, createdAt: -1 });
    UnitSchema.index({ company: 1, floor: 1, status: 1, createdAt: -1 });
    UnitSchema.index({ company: 1, project: 1, unitType: 1, createdAt: -1 });
    UnitSchema.index({ company: 1, unitType: 1, createdAt: -1 });

    // Orientation and construction-state filters
    UnitSchema.index({ company: 1, orientation: 1 });
    UnitSchema.index({ company: 1, constructionStatus: 1 });

    // Unit number lookup
    UnitSchema.index({ company: 1, unitNumber: 1 });

    // Units held by a reservation or a sale, by status
    UnitSchema.index({ company: 1, status: 1, reservation: 1 });
    UnitSchema.index({ company: 1, status: 1, sale: 1 });

    // Feature, price, area and room filters
    UnitSchema.index({ company: 1, hasBalcony: 1, hasTerrace: 1 });
    UnitSchema.index({ company: 1, hasSeaView: 1, hasCityView: 1 });
    UnitSchema.index({ company: 1, hasElevator: 1 });
    UnitSchema.index({ company: 1, priceCurrency: 1, price: 1 });
    UnitSchema.index({ company: 1, price: 1 });
    UnitSchema.index({ company: 1, area: 1 });
    UnitSchema.index({ company: 1, netArea: 1 });
    UnitSchema.index({ company: 1, numberOfRooms: 1 });
    UnitSchema.index({ company: 1, numberOfBathrooms: 1 });

    // Homepage featured units
    UnitSchema.index({ company: 1, deletedAt: 1, featuredOnHomepage: 1, featuredSortOrder: 1 });
}
