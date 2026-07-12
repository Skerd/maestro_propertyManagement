/**
 * Floor Service
 *
 * CRUD service for Floor model.
 */

import {ObjectId} from "mongodb";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Floor, {IFloor} from "./floor";
import {unitService} from "../unit/unit.service";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import Unit from "../unit/unit";
import {UserContext} from "@coreModule/utilities/types/types";
import type {
    EdificeMoneyByCurrency,
    EdificeStatistics
} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto";
import type {FloorStatistics} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/floor.dto";
import type {UnitStatistics} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto";

export type FloorUnitCoordinateRow = {
    polygonCoordinates: {x: number; y: number}[];
    _id: string;
    name: string;
};

type FloorListingAggregateRows = {
    unitsStats: any[];
    unitsByStatusResult: any[];
    unitValueByFloor: any[];
};

interface FloorStatsCurrencyAccum {
    currencyId: string;
    currencyName: string;
    currencySymbol: string;
    currencyAbbreviation: string;
    sum: number;
}

type FloorUnitsByStatus = {available: number; reserved: number; sold: number; unavailable: number; leased: number};

const STATUS_KEY_MAP: Record<string, keyof FloorUnitsByStatus> = {
    available_unit: "available",
    unavailable_unit: "unavailable",
    reserved_unit: "reserved",
    sold_unit: "sold",
    rented_unit: "leased",
};

export class FloorService extends BaseCrudService<IFloor, typeof Floor> {
    constructor() {
        super(Floor, "Floor");
    }

    private static emptyUnitsByStatus() {
        return {available: 0, reserved: 0, sold: 0, unavailable: 0, leased: 0};
    }

    private static parseAggMoneyValue(v: unknown): number {
        if (v == null) return 0;
        if (typeof v === "number" && !Number.isNaN(v)) return v;
        if (typeof v === "object" && v !== null && typeof (v as {toString?: () => string}).toString === "function") {
            return parseFloat((v as {toString: () => string}).toString()) || 0;
        }
        return parseFloat(String(v)) || 0;
    }

    private static addAggCurrencyItems(target: Map<string, FloorStatsCurrencyAccum>, items: any[] | undefined): void {
        for (const inv of items || []) {
            const value = FloorService.parseAggMoneyValue(inv?.value);
            const cid = inv?.currencyId;
            if (cid == null) continue;
            const k = cid.toString();
            const existing = target.get(k);
            if (existing) {
                existing.sum += value;
            } else {
                target.set(k, {
                    currencyId: k,
                    currencyName: inv.currencyName || "",
                    currencySymbol: inv.currencySymbol || "",
                    currencyAbbreviation: inv.currencyAbbreviation || "",
                    sum: value,
                });
            }
        }
    }

    private static currencyAccumMapToDto(map: Map<string, FloorStatsCurrencyAccum>): EdificeMoneyByCurrency[] {
        return [...map.values()].map((v) => ({
            currency: {
                _id: v.currencyId,
                name: v.currencyName,
                symbol: v.currencySymbol,
                abbreviation: v.currencyAbbreviation,
            },
            value: Number.isNaN(v.sum) ? 0 : v.sum,
        }));
    }

    private static mergeEdificeMoneyByCurrency(rows: EdificeMoneyByCurrency[]): EdificeMoneyByCurrency[] {
        const map = new Map<string, FloorStatsCurrencyAccum>();
        for (const row of rows) {
            const id = row.currency?._id;
            if (id == null) continue;
            const v = row.value ?? 0;
            const k = id.toString();
            const existing = map.get(k);
            if (existing) {
                existing.sum += v;
            } else {
                map.set(k, {
                    currencyId: k,
                    currencyName: row.currency?.name ?? "",
                    currencySymbol: row.currency?.symbol ?? "",
                    currencyAbbreviation: row.currency?.abbreviation ?? "",
                    sum: v,
                });
            }
        }
        return FloorService.currencyAccumMapToDto(map);
    }

    private static initFloorValueMaps(floorIds: ObjectId[]) {
        const totalValueByFloor = new Map<string, Map<string, FloorStatsCurrencyAccum>>();
        for (const id of floorIds) {
            totalValueByFloor.set(id.toString(), new Map());
        }
        return {totalValueByFloor};
    }

    private static buildFloorListingPipelines(floorIds: ObjectId[]) {
        const emptyMatch = [{$match: {floor: {$in: [] as ObjectId[]}}}];
        if (floorIds.length === 0) {
            return {
                unitsStatsPipeline: emptyMatch,
                unitsByStatusPipeline: emptyMatch,
                unitValueByFloorPipeline: emptyMatch,
            };
        }

        const unitsStatsPipeline = [
            {$match: {floor: {$in: floorIds}}},
            {
                $group: {
                    _id: "$floor",
                    totalUnits: {$sum: 1},
                    totalUnitsArea: {$sum: "$area"},
                    totalUnitsNetArea: {$sum: {$ifNull: ["$netArea", 0]}},
                    totalUnitsSharedArea: {$sum: {$ifNull: ["$sharedArea", 0]}},
                },
            },
        ];

        const unitsByStatusPipeline = [{$match: {floor: {$in: floorIds}}}, {$group: {_id: {floor: "$floor", status: "$status"}, count: {$sum: 1}}}];

        const unitValueByFloorPipeline = [
            {$match: {floor: {$in: floorIds}}},
            {
                $lookup: {
                    from: "currencies",
                    localField: "priceCurrency",
                    foreignField: "_id",
                    as: "currencyInfo",
                },
            },
            {$unwind: {path: "$currencyInfo", preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {floor: "$floor", currency: "$priceCurrency"},
                    totalValue: {$sum: "$price"},
                    currencyInfo: {$first: "$currencyInfo"},
                },
            },
            {
                $group: {
                    _id: "$_id.floor",
                    valueByCurrency: {
                        $push: {
                            currencyId: "$_id.currency",
                            currencyName: {$ifNull: ["$currencyInfo.name", ""]},
                            currencySymbol: {$ifNull: ["$currencyInfo.symbol", ""]},
                            currencyAbbreviation: {$ifNull: ["$currencyInfo.abbreviation", ""]},
                            value: "$totalValue",
                        },
                    },
                },
            },
        ];

        return {unitsStatsPipeline, unitsByStatusPipeline, unitValueByFloorPipeline};
    }

    private static async runFloorListingAggregates(floorIds: ObjectId[], options: {logger?: any; languageCode: string}): Promise<FloorListingAggregateRows> {
        const {logger, languageCode} = options;
        const p = FloorService.buildFloorListingPipelines(floorIds);
        const [unitsStats, unitsByStatusResult, unitValueByFloor] = await Promise.all([
            unitService.aggregate(p.unitsStatsPipeline, {logger, languageCode}),
            unitService.aggregate(p.unitsByStatusPipeline, {logger, languageCode}),
            unitService.aggregate(p.unitValueByFloorPipeline, {logger, languageCode}),
        ]);
        return {unitsStats, unitsByStatusResult, unitValueByFloor};
    }

    private static buildPerFloorRawStatisticsMap(floorIds: ObjectId[], agg: FloorListingAggregateRows): Map<string, any> {
        const statisticsMap = new Map<string, any>();
        const {totalValueByFloor} = FloorService.initFloorValueMaps(floorIds);

        for (const floorId of floorIds) {
            const key = floorId.toString();
            statisticsMap.set(key, {
                totalUnits: 0,
                totalUnitsArea: 0,
                totalUnitsNetArea: 0,
                totalUnitsSharedArea: 0,
                totalValue: [],
                unitsByStatus: FloorService.emptyUnitsByStatus(),
            });
        }

        for (const stat of agg.unitsStats) {
            const floorId = stat._id?.toString();
            if (!floorId) continue;
            const current = statisticsMap.get(floorId) || {};
            statisticsMap.set(floorId, {
                ...current,
                totalUnits: stat.totalUnits || 0,
                totalUnitsArea: stat.totalUnitsArea || 0,
                totalUnitsNetArea: stat.totalUnitsNetArea || 0,
                totalUnitsSharedArea: stat.totalUnitsSharedArea || 0,
            });
        }

        for (const row of agg.unitValueByFloor) {
            const floorId = row._id?.toString();
            if (floorId) FloorService.addAggCurrencyItems(totalValueByFloor.get(floorId)!, row.valueByCurrency);
        }

        for (const row of agg.unitsByStatusResult) {
            const floorId = row._id?.floor?.toString();
            const status = row._id?.status;
            const count = row.count || 0;
            if (floorId && status && STATUS_KEY_MAP[status]) {
                const current = statisticsMap.get(floorId) || {};
                const unitsByStatus = {...(current.unitsByStatus || FloorService.emptyUnitsByStatus())};
                const sk = STATUS_KEY_MAP[status];
                unitsByStatus[sk] = (unitsByStatus[sk] || 0) + count;
                statisticsMap.set(floorId, {...current, unitsByStatus});
            }
        }

        for (const floorId of floorIds) {
            const key = floorId.toString();
            const current = statisticsMap.get(key) || {
                totalUnits: 0,
                totalUnitsArea: 0,
                totalUnitsNetArea: 0,
                totalUnitsSharedArea: 0,
                unitsByStatus: FloorService.emptyUnitsByStatus(),
            };
            const tvMap = totalValueByFloor.get(key) || new Map();
            statisticsMap.set(key, {
                ...current,
                totalValue: FloorService.currencyAccumMapToDto(tvMap),
            });
        }

        return statisticsMap;
    }

    /**
     * Counts, areas, list value, and units-by-status use SchemaGuard on Unit.
     * Collected / not collected are rolled up from unitService.calculateStatistics (already permission-filtered per unit).
     */
    private static sanitizeFloorStatistics(
        statistics: EdificeStatistics & Record<string, unknown>,
        actionUserCtx: UserContext,
        languageCode: string
    ): FloorStatistics {
        const sanitized: FloorStatistics = {};

        try {
            const unitFields = SchemaGuard.sanitizeFields(Unit, {area: {}, price: {}, status: {}}, "read", actionUserCtx, languageCode);
            if (unitFields && Object.keys(unitFields).length > 0) {
                if (statistics.totalUnits !== undefined) sanitized.totalUnits = statistics.totalUnits;
                if (unitFields.area && statistics.totalUnitsArea !== undefined) sanitized.totalUnitsArea = statistics.totalUnitsArea;
                if (unitFields.area && statistics.totalUnitsNetArea !== undefined) sanitized.totalUnitsNetArea = statistics.totalUnitsNetArea;
                if (unitFields.area && statistics.totalUnitsSharedArea !== undefined) sanitized.totalUnitsSharedArea = statistics.totalUnitsSharedArea;
                if (unitFields.price && statistics.totalValue !== undefined) sanitized.totalValue = statistics.totalValue;
                if (unitFields.status && statistics.unitsByStatus) sanitized.unitsByStatus = statistics.unitsByStatus;
            }
        } catch {
            /* no unit read */
        }

        if (statistics.collectedAmount && Array.isArray(statistics.collectedAmount) && statistics.collectedAmount.length > 0) {
            sanitized.collectedAmount = statistics.collectedAmount as EdificeMoneyByCurrency[];
        }
        sanitized.notCollectedAmount = (statistics.notCollectedAmount as EdificeMoneyByCurrency[] | undefined) ?? [];

        if (statistics.verifiedPaidUnitCosts?.length) {
            sanitized.verifiedPaidUnitCosts = statistics.verifiedPaidUnitCosts as EdificeMoneyByCurrency[];
        }
        if (statistics.verifiedOutstandingUnitCosts?.length) {
            sanitized.verifiedOutstandingUnitCosts = statistics.verifiedOutstandingUnitCosts as EdificeMoneyByCurrency[];
        }
        if (statistics.pendingVerificationUnitCosts?.length) {
            sanitized.pendingVerificationUnitCosts = statistics.pendingVerificationUnitCosts as EdificeMoneyByCurrency[];
        }
        if (statistics.totalUnitCostDocuments !== undefined) {
            sanitized.totalUnitCostDocuments = statistics.totalUnitCostDocuments;
        }

        return sanitized;
    }

    private static rollupMoneyFromUnitStats(
        unitIdsOnFloor: string[],
        unitStatsById: Record<string, UnitStatistics>
    ): {
        collected: EdificeMoneyByCurrency[];
        notCollected: EdificeMoneyByCurrency[];
        verifiedPaidUnitCosts: EdificeMoneyByCurrency[];
        verifiedOutstandingUnitCosts: EdificeMoneyByCurrency[];
        pendingVerificationUnitCosts: EdificeMoneyByCurrency[];
        totalUnitCostDocuments: number;
    } {
        const collectedParts: EdificeMoneyByCurrency[] = [];
        const notCollectedParts: EdificeMoneyByCurrency[] = [];
        const verifiedPaidParts: EdificeMoneyByCurrency[] = [];
        const verifiedOutstandingParts: EdificeMoneyByCurrency[] = [];
        const pendingVerificationParts: EdificeMoneyByCurrency[] = [];
        let totalUnitCostDocuments = 0;
        for (const uid of unitIdsOnFloor) {
            const s = unitStatsById[uid];
            if (!s) continue;
            if (s.collectedAmount?.length) {
                collectedParts.push(...(s.collectedAmount as EdificeMoneyByCurrency[]));
            }
            if (s.notCollectedAmount?.length) {
                notCollectedParts.push(...(s.notCollectedAmount as EdificeMoneyByCurrency[]));
            }
            if (s.verifiedPaidUnitCosts?.length) {
                verifiedPaidParts.push(...(s.verifiedPaidUnitCosts as EdificeMoneyByCurrency[]));
            }
            if (s.verifiedOutstandingUnitCosts?.length) {
                verifiedOutstandingParts.push(...(s.verifiedOutstandingUnitCosts as EdificeMoneyByCurrency[]));
            }
            if (s.pendingVerificationUnitCosts?.length) {
                pendingVerificationParts.push(...(s.pendingVerificationUnitCosts as EdificeMoneyByCurrency[]));
            }
            if (s.unitCostDocumentCount != null) {
                totalUnitCostDocuments += s.unitCostDocumentCount;
            }
        }
        return {
            collected: FloorService.mergeEdificeMoneyByCurrency(collectedParts),
            notCollected: FloorService.mergeEdificeMoneyByCurrency(notCollectedParts),
            verifiedPaidUnitCosts: FloorService.mergeEdificeMoneyByCurrency(verifiedPaidParts),
            verifiedOutstandingUnitCosts: FloorService.mergeEdificeMoneyByCurrency(verifiedOutstandingParts),
            pendingVerificationUnitCosts: FloorService.mergeEdificeMoneyByCurrency(pendingVerificationParts),
            totalUnitCostDocuments,
        };
    }

    /**
     * Unit polygon coordinates grouped by floor id.
     * Returns an empty map when the caller lacks Unit `polygonCoordinates` read permission or omits `actionUserCtx` / `languageCode`.
     */
    async getUnitsCoordinatesByFloorIds(floorIds: ObjectId[], options: {logger?: any; languageCode?: string; actionUserCtx?: UserContext} = {}): Promise<Record<string, FloorUnitCoordinateRow[]>> {
        const {logger, languageCode, actionUserCtx} = options;
        const byFloor: Record<string, FloorUnitCoordinateRow[]> = {};
        if (floorIds.length === 0) {
            return byFloor;
        }
        if (actionUserCtx == null || languageCode == null) {
            return byFloor;
        }
        try {
            SchemaGuard.sanitizeFields(Unit, {polygonCoordinates: {}}, "read", actionUserCtx, languageCode);
        } catch {
            return byFloor;
        }
        const units = await unitService.find(
            {floor: {$in: floorIds}},
            {logger, languageCode},
            null,
            "polygonCoordinates name floor"
        );
        for (const u of units as any[]) {
            const fid = u.floor?._id != null ? u.floor._id.toString() : u.floor?.toString?.();
            if (!fid) continue;
            if (!byFloor[fid]) byFloor[fid] = [];
            byFloor[fid].push({
                polygonCoordinates: u.polygonCoordinates?.map((point: {x: number; y: number}) => ({x: point.x, y: point.y})) || [],
                _id: u._id.toString(),
                name: u.name,
            });
        }
        return byFloor;
    }

    /**
     * Calculates per-floor listing statistics and returns values sanitized for `actionUserCtx`.
     * Non-money metrics come from unit listing aggregates; collected / not collected are summed from unitService.calculateStatistics.
     */
    async calculateStatistics(floorIds: ObjectId[], actionUserCtx: UserContext, languageCode: string, options: {logger?: any} = {}): Promise<Record<string, FloorStatistics>> {
        const {logger} = options;

        if (floorIds.length === 0) {
            return {};
        }

        const agg = await FloorService.runFloorListingAggregates(floorIds, {logger, languageCode});
        const statisticsMap = FloorService.buildPerFloorRawStatisticsMap(floorIds, agg);

        const units = await unitService.find({floor: {$in: floorIds}}, {logger, languageCode}, null, "_id floor");
        const unitIdsByFloor = new Map<string, string[]>();
        const allUnitIds: ObjectId[] = [];
        for (const u of units as any[]) {
            const uid = u._id.toString();
            allUnitIds.push(u._id);
            const fid = u.floor?._id != null ? u.floor._id.toString() : u.floor?.toString?.();
            if (!fid) continue;
            if (!unitIdsByFloor.has(fid)) unitIdsByFloor.set(fid, []);
            unitIdsByFloor.get(fid)!.push(uid);
        }

        const unitStatsById =
            allUnitIds.length > 0 ? await unitService.calculateStatistics(allUnitIds, actionUserCtx, languageCode, {logger}) : {};

        const result: Record<string, FloorStatistics> = {};
        for (const floorId of floorIds) {
            const key = floorId.toString();
            const raw = statisticsMap.get(key) || {};
            const unitIdsOnFloor = unitIdsByFloor.get(key) || [];
            const rolled = FloorService.rollupMoneyFromUnitStats(unitIdsOnFloor, unitStatsById);
            const merged = {
                ...raw,
                collectedAmount: rolled.collected,
                notCollectedAmount: rolled.notCollected,
                ...(rolled.verifiedPaidUnitCosts.length > 0 ? {verifiedPaidUnitCosts: rolled.verifiedPaidUnitCosts} : {}),
                ...(rolled.verifiedOutstandingUnitCosts.length > 0 ? {verifiedOutstandingUnitCosts: rolled.verifiedOutstandingUnitCosts} : {}),
                ...(rolled.pendingVerificationUnitCosts.length > 0 ? {pendingVerificationUnitCosts: rolled.pendingVerificationUnitCosts} : {}),
                totalUnitCostDocuments: rolled.totalUnitCostDocuments,
            };
            result[key] = FloorService.sanitizeFloorStatistics(merged, actionUserCtx, languageCode);
        }
        return result;
    }
}

export const floorService = new FloorService();
