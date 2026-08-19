/**
 * Derives every unit's occupancy from the commercial documents that justify it.
 *
 * `unit.defaults` seeds all 246 units as `available_unit` and leaves `reservation` /
 * `sale` empty; this pass is what moves them, and it reads the reservations, sales and
 * leases that actually landed rather than the seed arrays, so a skipped row can never
 * leave a unit claiming a state nothing backs.
 *
 * The rule, confirmed against the live database:
 *
 * | source                          | status             |
 * |---------------------------------|--------------------|
 * | reservation `status: "active"`  | `reserved_unit`    |
 * | any sale                        | `sold_unit`        |
 * | lease `status: "active"`        | `rented_unit`      |
 * | `unavailableUnitIds`            | `unavailable_unit` |
 * | everything else                 | `available_unit`   |
 *
 * Expired / cancelled / converted reservations and expired / terminated leases
 * deliberately do not occupy a unit. `unavailable_unit` is the only state nothing
 * implies, which is why its ids are listed explicitly.
 *
 * It also rebuilds the `inspections`, `modificationRequests` and `costs` back-reference
 * arrays on each unit from the documents that point at it.
 */

import {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Reservation, {ReservationStatus} from "@propertyManagement/database/schemas/reservation/reservation";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import Lease, {LeaseStatus} from "@propertyManagement/database/schemas/lease/lease";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {unavailableUnitIds} from "./unavailableUnits.seed";

type Claim = {status: UnitStatus; reservation?: ObjectId; sale?: ObjectId};

/** Groups documents by the unit they point at. */
async function byUnit(
    model: {find: (filter: object) => {select: (fields: string) => {lean: () => Promise<unknown>}}},
    company: ICompany,
): Promise<Map<string, ObjectId[]>> {
    const rows = (await model.find({company: company._id}).select("_id unit").lean()) as {
        _id: ObjectId;
        unit?: ObjectId;
    }[];

    const grouped = new Map<string, ObjectId[]>();
    for (const row of rows) {
        if (!row.unit) continue;
        const key = String(row.unit);
        const list = grouped.get(key) ?? [];
        list.push(row._id);
        grouped.set(key, list);
    }
    return grouped;
}

export async function applyUnitOperationalState(
    parentLogger: serverLogger,
    company: ICompany,
    unitIds: Map<string, ObjectId>,
): Promise<void> {
    const logger = getLogger("mongoDbInitialization-applyUnitOperationalState", parentLogger);
    logger.start("Applying unit statuses and back-references...");

    try {
        const [activeReservations, sales, activeLeases] = await Promise.all([
            Reservation.find({company: company._id, status: ReservationStatus.ACTIVE})
                .select("_id unit")
                .lean(),
            Sale.find({company: company._id}).select("_id unit").lean(),
            Lease.find({company: company._id, status: LeaseStatus.ACTIVE}).select("_id unit").lean(),
        ]);

        const claims = new Map<string, Claim>();
        const claim = (unit: unknown, next: Claim) => {
            const key = String(unit);
            const existing = claims.get(key);
            if (existing && existing.status !== next.status) {
                logger.warn(
                    `Unit ${key} is claimed as both ${existing.status} and ${next.status}; ` +
                        `keeping ${next.status}.`,
                );
            }
            claims.set(key, next);
        };

        // Weakest claim first — a unit that is somehow both leased and sold reads as sold,
        // and a reservation (the newest commitment) outranks both.
        for (const id of unavailableUnitIds) {
            const unit = unitIds.get(id);
            if (unit) claim(unit, {status: UnitStatus.UNAVAILABLE});
        }
        for (const lease of activeLeases as {unit: ObjectId}[]) {
            claim(lease.unit, {status: UnitStatus.RENTED});
        }
        for (const sale of sales as {_id: ObjectId; unit: ObjectId}[]) {
            claim(sale.unit, {status: UnitStatus.SOLD, sale: sale._id});
        }
        for (const reservation of activeReservations as {_id: ObjectId; unit: ObjectId}[]) {
            claim(reservation.unit, {status: UnitStatus.RESERVED, reservation: reservation._id});
        }

        const [inspectionsByUnit, modificationsByUnit, costsByUnit] = await Promise.all([
            byUnit(Inspection as never, company),
            byUnit(ModificationRequest as never, company),
            byUnit(UnitCost as never, company),
        ]);

        const tally: Record<string, number> = {};

        for (const unitId of unitIds.values()) {
            const key = String(unitId);
            const {status, reservation, sale} = claims.get(key) ?? {status: UnitStatus.AVAILABLE};

            // The unit schema rejects RESERVED/SOLD without the document that justifies
            // it, and clears the pair on the way back to available — so each ref is
            // either set or removed, never left over from a previous run.
            const unset: Record<string, ""> = {};
            if (!reservation) unset.reservation = "";
            if (!sale) unset.sale = "";

            await Unit.updateOne(
                {_id: unitId},
                {
                    $set: {
                        status,
                        inspections: inspectionsByUnit.get(key) ?? [],
                        modificationRequests: modificationsByUnit.get(key) ?? [],
                        costs: costsByUnit.get(key) ?? [],
                        ...(reservation ? {reservation} : {}),
                        ...(sale ? {sale} : {}),
                    },
                    ...(Object.keys(unset).length ? {$unset: unset} : {}),
                },
            );

            tally[status] = (tally[status] ?? 0) + 1;
        }

        logger.debug(
            `Unit statuses: ${Object.entries(tally)
                .map(([status, count]) => `${count} ${status}`)
                .join(", ")}.`,
        );
        logger.finish("Finished applying unit statuses and back-references!", unitIds.size);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(e);
        logger.err(`Error applying unit operational state: ${message}`);
        logger.fail("Failed to apply unit statuses and back-references!");
    }
}
