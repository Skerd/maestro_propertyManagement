import {Decimal128, ObjectId} from "mongodb";
import Reservation, {ReservationStatus} from "./reservation";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {reservationsSeed} from "@propertyManagement/database/seeds/operations/reservations.seed";
import {
    opt,
    optDate,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";
import type {ReservationSource} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.constants";

export {reservationsSeed as defaultReservations};

/**
 * Seeds the demo reservations.
 *
 * `name` (RES-…) is auto-generated and immutable, so it is not exported and not set
 * here; idempotency keys on the preserved `_id` instead. Only `status: "active"`
 * reservations occupy their unit — the unit-status pass derives that from what
 * actually landed, not from this file.
 */
export async function createReservations(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    unitIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createReservations", parentLogger);
    logger.start(`Creating reservations (${reservationsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of reservationsSeed) {
        try {
            const unit = unitIds.get(row.unit);
            if (!unit) {
                logger.warn(`Skipping reservation ${row.id}: its unit was not seeded.`);
                continue;
            }

            const reservedBy = resolveUser(refs, row.reservedBy);
            const client = resolveUser(refs, row.client);
            if (!reservedBy || !client) {
                logger.warn(
                    `Skipping reservation ${row.id}: user "${row.reservedBy.$user}" or ` +
                        `"${row.client.$user}" not found.`,
                );
                continue;
            }

            const reservationId = new ObjectId(row.id);
            const payload = {
                unit,
                reservedBy,
                reservedByCompany: company._id,
                client,
                reservationDate: new Date(row.reservationDate),
                ...optDate("expirationDate", row.expirationDate),
                reservationNotes: row.reservationNotes,
                depositAmount: Decimal128.fromString(row.depositAmount),
                ...opt("depositCurrency", resolveCurrency(refs, row.depositCurrency)),
                paymentMethod: row.paymentMethod,
                source: row.source as ReservationSource,
                paid: row.paid,
                isActive: row.isActive,
                status: row.status as ReservationStatus,
                ...optDate("cancelledAt", row.cancelledAt),
                ...opt("cancellationReason", row.cancellationReason),
                ...optDate("expiredAt", row.expiredAt),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Reservation.findById(reservationId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Reservation.create({_id: reservationId, ...payload});
            }

            created.set(row.id, reservationId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating reservation ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating reservations!", created.size);
    return created;
}
