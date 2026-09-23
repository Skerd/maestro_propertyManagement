import {ObjectId} from "mongodb";
import User from "@coreModule/database/schemas/user/user";
import {findClientHoldings, type ClientRelation} from "@propertyManagement/utilities/marketing/clientAudience";

export type RecipientUnit = {unitId: string; unitNumber?: string; unitName?: string; relation: ClientRelation};

export type ConstructionProgressRecipient = {
    userId: string;
    email: string;
    fullName: string;
    units: RecipientUnit[];
};

type UserLite = {_id: ObjectId; username?: string; name?: string; surname?: string; fullName?: string};

/**
 * Clients to tell about construction progress in a project (optionally one building):
 * buyers of the units' current sales (not rejected) plus clients holding an active reservation.
 * One entry per user, listing every unit they hold in scope. Inactive / foreign users are dropped.
 *
 * The buyer/reservation union itself lives in `findClientHoldings`, shared with
 * ad campaigns so both features agree on who a client is.
 */
export async function findConstructionProgressRecipients(scope: {
    company: ObjectId;
    project: ObjectId;
    edifice?: ObjectId | null;
}): Promise<ConstructionProgressRecipient[]> {
    const {holdings, unitById} = await findClientHoldings({
        company: scope.company,
        projects: [scope.project],
        edifice: scope.edifice,
    });
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
