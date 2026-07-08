import {
    inheritedOnlyUnitCostMatchFragments,
    type UnitCostHierarchyIdSets,
    UNIT_COST_SOFT_DELETE_MATCH,
} from "./unitCostHierarchy.util";
import {ObjectId} from "mongodb";

export const UNIT_COST_DOC_SUBTOTAL_STAGE = {
    $addFields: {
        docSubtotal: {
            $sum: {
                $map: {
                    input: {$ifNull: ["$expenditureItems", []]},
                    as: "row",
                    in: {
                        $multiply: [
                            {$toDouble: {$ifNull: ["$$row.amount", 0]}},
                            {$convert: {input: "$$row.pricePerUnit", to: "double", onError: 0, onNull: 0}},
                        ],
                    },
                },
            },
        },
    },
};

function targetUnitsLookupStage(companyId: ObjectId, unitIds: ObjectId[]) {
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
                    $match: {
                        _id: {$in: unitIds},
                        company: companyId,
                    },
                },
                {$lookup: {from: "floors", localField: "floor", foreignField: "_id", as: "__fl"}},
                {$unwind: "$__fl"},
                {$lookup: {from: "edifices", localField: "__fl.edifice", foreignField: "_id", as: "__ed"}},
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
            ],
            as: "targetUnits",
        },
    };
}

function incompleteInheritedMatchPipeline(): Record<string, unknown>[] {
    return [{$match: {_id: {$in: []}}}];
}

/** Money rows keyed by unit (same shape as direct `unitCostVerifiedPaidByUnit`-style aggregates). */
export function inheritedUnitCostMoneyByUnitPipeline(
    companyId: ObjectId,
    unitIds: ObjectId[],
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
        targetUnitsLookupStage(companyId, unitIds),
        {$match: {targetUnits: {$ne: []}}},
        {
            $addFields: {
                __allocSubtotal: {
                    $divide: [
                        "$docSubtotal",
                        {$max: [{$size: {$ifNull: ["$targetUnits", []]}}, 1]},
                    ],
                },
            },
        },
        {$unwind: "$targetUnits"},
        {
            $lookup: {
                from: "currencies",
                localField: "currency",
                foreignField: "_id",
                as: "currencyInfo",
            },
        },
        {$unwind: {path: "$currencyInfo", preserveNullAndEmptyArrays: true}},
        {
            $group: {
                _id: {unit: "$targetUnits._id", currency: "$currency"},
                total: {$sum: "$__allocSubtotal"},
                currencyInfo: {$first: "$currencyInfo"},
            },
        },
        {
            $group: {
                _id: "$_id.unit",
                collectedByCurrency: {
                    $push: {
                        currencyId: "$_id.currency",
                        currencyName: {$ifNull: ["$currencyInfo.name", ""]},
                        currencySymbol: {$ifNull: ["$currencyInfo.symbol", ""]},
                        currencyAbbreviation: {$ifNull: ["$currencyInfo.abbreviation", ""]},
                        value: "$total",
                    },
                },
            },
        },
    ];
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
