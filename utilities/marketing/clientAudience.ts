import {ObjectId} from "mongodb";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale, {SaleApprovalStatus} from "@propertyManagement/database/schemas/sale/sale";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";

export type ClientRelation = "buyer" | "reservation";

export type UnitLite = {_id: ObjectId; unitNumber?: string | number; name?: string; sale?: ObjectId | null};

/**
 * Who counts as a "client" of a company, and for which units.
 *
 * One definition, shared by construction-progress notifications and ad
 * campaigns. Both need the same union — buyers of non-rejected sales plus
 * holders of active reservations — and duplicating the query is exactly how the
 * two would silently drift apart, so that the same person could be a client for
 * one feature and not the other.
 *
 * Returns `userId -> unitId -> relation`. A buyer relation beats a reservation
 * on the same unit. Soft-deleted units, sales and reservations are excluded by
 * the softDelete plugin's find hooks.
 */
export async function findClientHoldings(scope: {
    company: ObjectId;
    /** Restrict to units of these projects. Empty/absent = every project. */
    projects?: ObjectId[];
    /** Restrict to one building. */
    edifice?: ObjectId | null;
    /** Restrict to these exact units; wins over `projects`. */
    units?: ObjectId[];
}): Promise<{holdings: Map<string, Map<string, ClientRelation>>; unitById: Map<string, UnitLite>}> {
    const unitFilter: Record<string, unknown> = {company: scope.company};

    if (scope.units?.length) {
        unitFilter._id = scope.units.length === 1 ? scope.units[0] : {$in: scope.units};
    }
    else if (scope.projects?.length) {
        // Direct equality for the single-project case: it is the shape the
        // construction-progress caller has always emitted, and it spares Mongo
        // a one-element `$in`.
        unitFilter.project = scope.projects.length === 1 ? scope.projects[0] : {$in: scope.projects};
    }
    if (scope.edifice) unitFilter.edifice = scope.edifice;

    const units = await Unit.find(unitFilter).select("_id unitNumber name sale").lean<UnitLite[]>();
    if (!units.length) return {holdings: new Map(), unitById: new Map()};

    const unitById = new Map(units.map(u => [u._id.toString(), u]));
    const saleIds = units.map(u => u.sale).filter((id): id is ObjectId => !!id);

    const [sales, reservations] = await Promise.all([
        saleIds.length
            ? Sale.find({
                  company: scope.company,
                  _id: {$in: saleIds},
                  buyer: {$ne: null},
                  approvalStatus: {$ne: SaleApprovalStatus.REJECTED},
              }).select("unit buyer").lean<{unit: ObjectId; buyer: ObjectId}[]>()
            : Promise.resolve([]),
        Reservation.find({
            company: scope.company,
            unit: {$in: units.map(u => u._id)},
            isActive: true,
            client: {$ne: null},
        })
            .select("unit client")
            .lean<{unit: ObjectId; client: ObjectId}[]>(),
    ]);

    const holdings = new Map<string, Map<string, ClientRelation>>();
    const add = (userId: ObjectId, unitId: ObjectId, relation: ClientRelation) => {
        const perUser = holdings.get(userId.toString()) ?? new Map<string, ClientRelation>();
        if (perUser.get(unitId.toString()) !== "buyer") perUser.set(unitId.toString(), relation);
        holdings.set(userId.toString(), perUser);
    };
    for (const s of sales) add(s.buyer, s.unit, "buyer");
    for (const r of reservations) add(r.client, r.unit, "reservation");

    return {holdings, unitById};
}
