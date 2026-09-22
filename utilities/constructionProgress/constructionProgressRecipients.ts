import {ObjectId} from "mongodb";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Sale, {SaleApprovalStatus} from "@propertyManagement/database/schemas/sale/sale";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import User from "@coreModule/database/schemas/user/user";

export type RecipientUnit = {unitId: string; unitNumber?: string; unitName?: string; relation: "buyer" | "reservation"};

export type ConstructionProgressRecipient = {
    userId: string;
    email: string;
    fullName: string;
    units: RecipientUnit[];
};

type UnitLite = {_id: ObjectId; unitNumber?: string | number; name?: string; sale?: ObjectId | null};
type UserLite = {_id: ObjectId; username?: string; name?: string; surname?: string; fullName?: string};

/**
 * Clients to tell about construction progress in a project (optionally one building):
 * buyers of the units' current sales (not rejected) plus clients holding an active reservation.
 * One entry per user, listing every unit they hold in scope. Inactive / foreign users are dropped.
 * Soft-deleted units, sales and reservations are excluded by the softDelete plugin's find hooks.
 */
export async function findConstructionProgressRecipients(scope: {
    company: ObjectId;
    project: ObjectId;
    edifice?: ObjectId | null;
}): Promise<ConstructionProgressRecipient[]> {
    const unitFilter: Record<string, unknown> = {company: scope.company, project: scope.project};
    if (scope.edifice) unitFilter.edifice = scope.edifice;
    const units = await Unit.find(unitFilter).select("_id unitNumber name sale").lean<UnitLite[]>();
    if (!units.length) return [];

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
        Reservation.find({company: scope.company, unit: {$in: units.map(u => u._id)}, isActive: true, client: {$ne: null}})
            .select("unit client")
            .lean<{unit: ObjectId; client: ObjectId}[]>(),
    ]);

    // userId → unitId → relation (a buyer relation wins over a reservation on the same unit)
    const holdings = new Map<string, Map<string, RecipientUnit["relation"]>>();
    const add = (userId: ObjectId, unitId: ObjectId, relation: RecipientUnit["relation"]) => {
        const perUser = holdings.get(userId.toString()) ?? new Map();
        if (perUser.get(unitId.toString()) !== "buyer") perUser.set(unitId.toString(), relation);
        holdings.set(userId.toString(), perUser);
    };
    for (const s of sales) add(s.buyer, s.unit, "buyer");
    for (const r of reservations) add(r.client, r.unit, "reservation");
    if (!holdings.size) return [];

    const users = await User.find({
        _id: {$in: [...holdings.keys()].map(id => new ObjectId(id))},
        companies: scope.company,
        isActive: true,
    })
        .select("_id username name surname fullName")
        .lean<UserLite[]>();

    return users
        .filter(u => !!u.username)
        .map(u => {
            const perUser = holdings.get(u._id.toString())!;
            const heldUnits: RecipientUnit[] = [...perUser.entries()].map(([unitId, relation]) => {
                const unit = unitById.get(unitId);
                return {
                    unitId,
                    unitNumber: unit?.unitNumber != null ? String(unit.unitNumber) : undefined,
                    unitName: unit?.name,
                    relation,
                };
            });
            return {
                userId: u._id.toString(),
                email: u.username!,
                fullName: u.fullName || `${u.name ?? ""} ${u.surname ?? ""}`.trim() || u.username!,
                units: heldUnits,
            };
        });
}
