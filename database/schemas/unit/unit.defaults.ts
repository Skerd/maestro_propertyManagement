import {Decimal128, ObjectId} from "mongodb";
import Unit from "./unit";
import Floor from "@propertyManagement/database/schemas/floor/floor";
import UnitType from "@propertyManagement/database/schemas/unitType/unitType";
import Currency from "@coreModule/database/schemas/currency/currency";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {unitsSeed} from "@propertyManagement/database/seeds/hierarchy/units.seed";
import {
    UnitStatus,
    type UnitConstructionStatus,
    type UnitOrientation,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

export {unitsSeed as defaultUnits};

/**
 * Seeds the demo units. Runs last in the hierarchy, after floors.
 *
 * Every unit is seeded as {@link UnitStatus.AVAILABLE} with empty `reservation`,
 * `sale`, `costs`, `inspections`, `modificationRequests` and `priceHistory`. The
 * commercial seeds (reservations, sales, leases) are what move a unit to reserved /
 * sold / rented, so the occupied set is always derived from the documents that
 * justify it rather than hardcoded here.
 */
export async function createUnits(
    parentLogger: serverLogger,
    company: ICompany,
    availableMedia: Set<string>,
    floorIds: Map<string, ObjectId>,
    edificeIds: Map<string, ObjectId>,
    projectIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createUnits", parentLogger);
    logger.start(`Creating units (${unitsSeed.length})...`);

    const [currencies, unitTypes] = await Promise.all([
        Currency.find({}).select("_id abbreviation").lean(),
        UnitType.find({company: company._id}).select("_id name").lean(),
    ]);
    const currencyByCode = new Map<string, ObjectId>(
        (currencies as any[]).map((c) => [String(c.abbreviation), c._id as ObjectId]),
    );
    const unitTypeByName = new Map<string, ObjectId>(
        (unitTypes as any[]).map((t) => [String(t.name), t._id as ObjectId]),
    );

    const created = new Map<string, ObjectId>();
    const unitsPerFloor = new Map<string, number>();

    for (const row of unitsSeed) {
        try {
            const floor = row.floorId ? floorIds.get(row.floorId) : undefined;
            if (!floor) {
                logger.warn(`Skipping unit "${row.unitNumber}": its floor was not seeded.`);
                continue;
            }

            const unitType = row.unitTypeName ? unitTypeByName.get(row.unitTypeName) : undefined;
            if (!unitType) {
                logger.warn(`Skipping unit "${row.unitNumber}": unit type "${row.unitTypeName}" not found.`);
                continue;
            }

            const priceCurrency = row.priceCurrencyCode ? currencyByCode.get(row.priceCurrencyCode) : undefined;
            if (!priceCurrency) {
                logger.warn(`Skipping unit "${row.unitNumber}": currency "${row.priceCurrencyCode}" not found.`);
                continue;
            }

            const unitId = new ObjectId(row.id);
            const mainImage =
                row.mainImageId && availableMedia.has(row.mainImageId)
                    ? new ObjectId(row.mainImageId)
                    : undefined;

            const payload = {
                unitType,
                unitNumber: row.unitNumber,
                name: row.name,
                area: row.area,
                sharedArea: row.sharedArea,
                netArea: row.netArea,
                verandaArea: row.verandaArea,
                price: Decimal128.fromString(row.price ?? "0"),
                priceCurrency,
                hasBalcony: row.hasBalcony,
                hasTerrace: row.hasTerrace,
                hasSeaView: row.hasSeaView,
                hasCityView: row.hasCityView,
                hasLakeView: row.hasLakeView,
                hasElevator: row.hasElevator,
                ...(row.orientation ? {orientation: row.orientation as UnitOrientation} : {}),
                ...(row.constructionStatus
                    ? {constructionStatus: row.constructionStatus as UnitConstructionStatus}
                    : {}),
                numberOfRooms: row.numberOfRooms,
                numberOfBathrooms: row.numberOfBathrooms,
                description: row.description,
                ...(row.saleCommissionRatePercent
                    ? {saleCommissionRatePercent: Decimal128.fromString(row.saleCommissionRatePercent)}
                    : {}),
                ...(row.reservationCommissionRatePercent
                    ? {
                          reservationCommissionRatePercent: Decimal128.fromString(
                              row.reservationCommissionRatePercent,
                          ),
                      }
                    : {}),
                polygonCoordinates: row.polygonCoordinates.map((p) => ({x: p.x, y: p.y})),
                featuredOnHomepage: row.featuredOnHomepage,
                featuredSortOrder: row.featuredSortOrder,
                // Derived state — owned by the commercial seeds, never by this file.
                status: UnitStatus.AVAILABLE,
                connectedUnits: [],
                inspections: [],
                modificationRequests: [],
                costs: [],
                priceHistory: [],
                floor,
                ...(row.edificeId && edificeIds.get(row.edificeId)
                    ? {edifice: edificeIds.get(row.edificeId)}
                    : {}),
                ...(row.projectId && projectIds.get(row.projectId)
                    ? {project: projectIds.get(row.projectId)}
                    : {}),
                ...(mainImage ? {mainImage} : {}),
                imageGallery: [],
                videoGallery: [],
                mediaFiles: [],
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Unit.findById(unitId);
            if (existing) {
                existing.set(payload);
                existing.set("reservation", undefined);
                existing.set("sale", undefined);
                await existing.save();
            } else {
                await Unit.create({_id: unitId, ...payload});
            }

            created.set(row.id, unitId);
            unitsPerFloor.set(String(floor), (unitsPerFloor.get(String(floor)) ?? 0) + 1);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating unit "${row.unitNumber}": ${message}`);
        }
    }

    // Recompute the floor counter from what actually landed.
    for (const [floorId, total] of unitsPerFloor) {
        await Floor.updateOne({_id: new ObjectId(floorId)}, {$set: {totalUnits: total}});
    }

    if (created.size === 0) {
        logger.fail("Failed to create units!");
    } else {
        logger.finish("Finished creating units!", created.size);
    }

    return created;
}
