import {
    inheritedOnlyUnitCostMatchFragments,
    type UnitCostHierarchyIdSets,
    UNIT_COST_SOFT_DELETE_MATCH,
} from "./unitCostHierarchy.util";
import {ObjectId} from "mongodb";
import {allocateMinor, DEFAULT_DECIMAL_PLACES, fromMinor, toMinor} from "armonia/src/modules/core/helpers/money";
import {aggregateCurrencyFields, type AggregateMoneyLine} from "../../../utilities/statistics/moneyTotals";

/** A unit cost's line total (quantity × unit price), in Decimal128 so the sums are exact (GLB-08, TD-B166). */
export const UNIT_COST_DOC_SUBTOTAL_STAGE = {
    $addFields: {
        docSubtotal: {
            $sum: {
                $map: {
                    input: {$ifNull: ["$expenditureItems", []]},
                    as: "row",
                    in: {
                        $multiply: [
                            {$toDecimal: {$ifNull: ["$$row.amount", 0]}},
                            {$convert: {input: "$$row.pricePerUnit", to: "decimal", onError: {$toDecimal: 0}, onNull: {$toDecimal: 0}}},
                        ],
                    },
                },
            },
        },
    },
};

/**
 * The units a floor/edifice/project cost is shared over. With `unitIds`, only those of them; with `null`, every unit
 * under the cost's scope, so a share does not depend on which units a request shows (TD-B171).
 */
function targetUnitsLookupStage(companyId: ObjectId, unitIds: ObjectId[] | null) {
    return {
        $lookup: {
            from: "units",
            let: {
                cFloor: {$ifNull: ["$floor", null]},
                cEdifice: {$ifNull: ["$edifice", null]},
                cProject: {$ifNull: ["$project", null]},
            },
            pipeline: [
                {
                    // Joined collections are not filtered by the soft-delete hook (DB-04).
                    $match: {
                        ...(unitIds ? {_id: {$in: unitIds}} : {}),
                        company: companyId,
                        deletedAt: null,
                    },
                },
                {$project: {_id: 1, floor: 1}},
                {$lookup: {from: "floors", localField: "floor", foreignField: "_id", pipeline: [{$match: {deletedAt: null}}], as: "__fl"}},
                {$unwind: "$__fl"},
                {$lookup: {from: "edifices", localField: "__fl.edifice", foreignField: "_id", pipeline: [{$match: {deletedAt: null}}], as: "__ed"}},
                {$unwind: "$__ed"},
                {
                    $match: {
                        $expr: {
                            $or: [
                                {
                                    $and: [
                                        {$ne: [{$ifNull: ["$$cFloor", null]}, null]},
                                        {$eq: ["$floor", "$$cFloor"]},
                                    ],
                                },
                                {
                                    $and: [
                                        {$eq: [{$ifNull: ["$$cFloor", null]}, null]},
                                        {$ne: [{$ifNull: ["$$cEdifice", null]}, null]},
                                        {$eq: ["$__fl.edifice", "$$cEdifice"]},
                                    ],
                                },
                                {
                                    $and: [
                                        {$eq: [{$ifNull: ["$$cFloor", null]}, null]},
                                        {$eq: [{$ifNull: ["$$cEdifice", null]}, null]},
                                        {$ne: [{$ifNull: ["$$cProject", null]}, null]},
                                        {$eq: ["$__ed.project", "$$cProject"]},
                                    ],
                                },
                            ],
                        },
                    },
                },
                {$project: {_id: 1}},
            ],
            as: "targetUnits",
        },
    };
}

function incompleteInheritedMatchPipeline(): Record<string, unknown>[] {
    return [{$match: {_id: {$in: []}}}];
}

/**
 * Inherited costs in one state (`statusMatch`) with every unit each is shared over; {@link inheritedUnitCostShareRows}
 * splits them. Each row is an {@link AggregateMoneyLine} (its line total as `value`) plus `targetUnitIds`.
 */
export function inheritedUnitCostMoneyByUnitPipeline(
    companyId: ObjectId,
    sets: UnitCostHierarchyIdSets,
    statusMatch: Record<string, unknown>,
): Record<string, unknown>[] {
    const inheritedFrag = inheritedOnlyUnitCostMatchFragments(sets);
    if (!inheritedFrag) {
        return incompleteInheritedMatchPipeline();
    }
    return [
        {
            $match: {
                company: companyId,
                ...statusMatch,
                ...UNIT_COST_SOFT_DELETE_MATCH,
                ...inheritedFrag,
            },
        },
        UNIT_COST_DOC_SUBTOTAL_STAGE,
        targetUnitsLookupStage(companyId, null),
        {$match: {targetUnits: {$ne: []}}},
        {$lookup: {from: "currencies", localField: "currency", foreignField: "_id", as: "currencyInfo"}},
        {$unwind: {path: "$currencyInfo", preserveNullAndEmptyArrays: true}},
        {
            $project: {
                _id: 0,
                currencyId: "$currency",
                ...aggregateCurrencyFields("currencyInfo"),
                value: "$docSubtotal",
                targetUnitIds: "$targetUnits._id",
            },
        },
    ];
}

/** One inherited cost from {@link inheritedUnitCostMoneyByUnitPipeline}. */
export type InheritedUnitCostRow = AggregateMoneyLine & {targetUnitIds?: unknown[]};

/**
 * The requested units' shares of inherited costs, as per-unit `collectedByCurrency` lines. Each cost is split over all
 * its target units with `allocateMinor` (GLB-08): the shares add up to the cost exactly, the leftover cents go to the
 * units first in id order, and a unit's share is the same whichever units are asked for.
 */
export function inheritedUnitCostShareRows(
    rows: readonly InheritedUnitCostRow[],
    unitIds: readonly ObjectId[],
): {_id: string; collectedByCurrency: AggregateMoneyLine[]}[] {
    const requested = new Set(unitIds.map(String));
    const byUnit = new Map<string, AggregateMoneyLine[]>();
    for (const {targetUnitIds, value, ...line} of rows) {
        const targets = [...new Set((targetUnitIds ?? []).map(String))].sort();
        if (line.currencyId == null || targets.length === 0) continue;
        const decimals = line.currencyDecimalPlaces ?? DEFAULT_DECIMAL_PLACES;
        const shares = allocateMinor(toMinor(value == null ? 0 : String(value), decimals), targets.length);
        targets.forEach((unitId, index) => {
            if (!requested.has(unitId)) return;
            const lines = byUnit.get(unitId) ?? [];
            lines.push({...line, value: fromMinor(shares[index], decimals)});
            byUnit.set(unitId, lines);
        });
    }
    return [...byUnit].map(([_id, collectedByCurrency]) => ({_id, collectedByCurrency}));
}

/** Document counts per unit for inherited-scope costs (each cost counts once per attributed unit). */
export function inheritedUnitCostCountByUnitPipeline(
    companyId: ObjectId,
    unitIds: ObjectId[],
    sets: UnitCostHierarchyIdSets,
): Record<string, unknown>[] {
    const inheritedFrag = inheritedOnlyUnitCostMatchFragments(sets);
    if (!inheritedFrag) {
        return incompleteInheritedMatchPipeline();
    }
    return [
        {
            $match: {
                company: companyId,
                ...UNIT_COST_SOFT_DELETE_MATCH,
                ...inheritedFrag,
            },
        },
        targetUnitsLookupStage(companyId, unitIds),
        {$match: {targetUnits: {$ne: []}}},
        {$unwind: "$targetUnits"},
        {
            $group: {
                _id: "$targetUnits._id",
                count: {$sum: 1},
            },
        },
    ];
}
