import {ObjectId} from "mongodb";
import {SaleApprovalStatus} from "@propertyManagement/database/schemas/sale/sale";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {leaseService} from "@propertyManagement/database/schemas/lease/lease.service";
import {LeaseStatus} from "@propertyManagement/database/schemas/lease/lease";
import {userService} from "@coreModule/database/schemas/user/user.service";

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

    const units = await unitService.findAudienceUnitsLean(unitFilter);
    if (!units.length) return {holdings: new Map(), unitById: new Map()};

    const unitById = new Map(units.map(u => [u._id.toString(), u]));
    const saleIds = units.map(u => u.sale).filter((id): id is ObjectId => !!id);

    const [sales, reservations] = await Promise.all([
        saleIds.length
            ? saleService.findBuyersLean({
                  company: scope.company,
                  _id: {$in: saleIds},
                  buyer: {$ne: null},
                  approvalStatus: {$ne: SaleApprovalStatus.REJECTED},
              })
            : Promise.resolve([]),
        reservationService.findClientsLean({
            company: scope.company,
            unit: {$in: units.map(u => u._id)},
            isActive: true,
            client: {$ne: null},
        }),
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

/**
 * The users among `userIds` a client email may still go to (D131): active members of the company (membership
 * `roles[].active` = "active", the rule of the client picker and of login), and anyone tied to one of its units, whatever
 * their membership: the buyer of a sale that was not rejected, the client of an active reservation, the tenant of an
 * active lease. A member an administrator deactivated, with no unit, is left out.
 */
export async function clientEmailRecipients(company: ObjectId, userIds: ObjectId[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const ids = {$in: userIds};
    const [members, sales, reservations, leases] = await Promise.all([
        userService.find({_id: ids, roles: {$elemMatch: {company, active: "active"}}}, {}, undefined, "_id"),
        saleService.findBuyersLean({company, buyer: ids, approvalStatus: {$ne: SaleApprovalStatus.REJECTED}}),
        reservationService.findClientsLean({company, client: ids, isActive: true}),
        leaseService.findTenantsLean({company, tenant: ids, status: LeaseStatus.ACTIVE}),
    ]);
    return new Set([
        ...members.map(u => u._id.toString()),
        ...sales.map(s => s.buyer.toString()),
        ...reservations.map(r => r.client.toString()),
        ...leases.map(l => l.tenant.toString()),
    ]);
}

