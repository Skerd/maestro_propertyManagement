/**
 * Edifice Service
 *
 * CRUD service for Edifice model.
 */

import {ObjectId} from 'mongodb';
import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import Edifice, {IEdifice} from './edifice';
import {floorService} from '../floor/floor.service';
import {unitService} from '../unit/unit.service';
import {
    EdificeMoneyByCurrency,
    EdificeStatistics
} from 'armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto';
import type {UnitStatistics} from 'armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto';
import {UserContext} from '@coreModule/utilities/types/types';
import SchemaGuard from '@coreModule/database/security/schemaGuard';
import Floor from '../floor/floor';
import Unit from '../unit/unit';
import {COLLECTED_DATA} from '@coreModule/database/collections';

export type EdificeFloorCoordinateRow = {
    polygonCoordinates: {x: number; y: number}[];
    _id: string;
    name: string;
};

export type EdificeProjectCoordinateRow = {
    polygonCoordinates: {x: number; y: number}[];
    _id: string;
    name: string;
    floorsCoordinates?: {
        polygonCoordinates: {x: number; y: number}[];
        _id: string;
        name: string;
    }[];
};

type FloorListingAggregateRows = {
    unitsStats: any[];
    unitsByStatusResult: any[];
    unitValueByFloor: any[];
};

interface EdificeStatsCurrencyAccum {
    currencyId: string;
    currencyName: string;
    currencySymbol: string;
    currencyAbbreviation: string;
    sum: number;
}

const STATUS_KEY_MAP: Record<string, keyof {available: number; reserved: number; sold: number; unavailable: number}> = {
    available_unit: 'available',
    unavailable_unit: 'unavailable',
    reserved_unit: 'reserved',
    sold_unit: 'sold',
};

export class EdificeService extends BaseCrudService<IEdifice, typeof Edifice> {
    constructor() {
        super(Edifice, 'Edifice');
    }

    private static emptyUnitsByStatus() {
        return {available: 0, reserved: 0, sold: 0, unavailable: 0};
    }

    private static parseAggMoneyValue(v: unknown): number {
        if (v == null) return 0;
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        if (typeof v === 'object' && v !== null && typeof (v as {toString?: () => string}).toString === 'function') {
            return parseFloat((v as {toString: () => string}).toString()) || 0;
        }
        return parseFloat(String(v)) || 0;
    }

    private static addAggCurrencyItems(target: Map<string, EdificeStatsCurrencyAccum>, items: any[] | undefined): void {
        for (const inv of items || []) {
            const value = EdificeService.parseAggMoneyValue(inv?.value);
            const cid = inv?.currencyId;
            if (cid == null) continue;
            const k = cid.toString();
            const existing = target.get(k);
            if (existing) {
                existing.sum += value;
            } else {
                target.set(k, {
                    currencyId: k,
                    currencyName: inv.currencyName || '',
                    currencySymbol: inv.currencySymbol || '',
                    currencyAbbreviation: inv.currencyAbbreviation || '',
                    sum: value,
                });
            }
        }
    }

    private static currencyAccumMapToDto(map: Map<string, EdificeStatsCurrencyAccum>): EdificeMoneyByCurrency[] {
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
        const map = new Map<string, EdificeStatsCurrencyAccum>();
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
                    currencyName: row.currency?.name ?? '',
                    currencySymbol: row.currency?.symbol ?? '',
                    currencyAbbreviation: row.currency?.abbreviation ?? '',
                    sum: v,
                });
            }
        }
        return EdificeService.currencyAccumMapToDto(map);
    }

    private static initEdificeValueMaps(edificeIds: ObjectId[]) {
        const totalValueByEdifice = new Map<string, Map<string, EdificeStatsCurrencyAccum>>();
        for (const id of edificeIds) {
            totalValueByEdifice.set(id.toString(), new Map());
        }
        return {totalValueByEdifice};
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
                    _id: '$floor',
                    totalUnits: {$sum: 1},
                    totalUnitsArea: {$sum: '$area'},
                    totalUnitsNetArea: {$sum: {$ifNull: ['$netArea', 0]}},
                    totalUnitsSharedArea: {$sum: {$ifNull: ['$sharedArea', 0]}},
                },
            },
        ];

        const unitsByStatusPipeline = [{$match: {floor: {$in: floorIds}}}, {$group: {_id: {floor: '$floor', status: '$status'}, count: {$sum: 1}}}];

        const unitValueByFloorPipeline = [
            {$match: {floor: {$in: floorIds}}},
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'priceCurrency',
                    foreignField: '_id',
                    as: 'currencyInfo',
                },
            },
            {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {floor: '$floor', currency: '$priceCurrency'},
                    totalValue: {$sum: '$price'},
                    currencyInfo: {$first: '$currencyInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.floor',
                    valueByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$totalValue',
                        },
                    },
                },
            },
        ];

        return {unitsStatsPipeline, unitsByStatusPipeline, unitValueByFloorPipeline};
    }

    private static async runFloorListingAggregates(floorIds: ObjectId[], options: {logger?: any; languageCode: string}): Promise<FloorListingAggregateRows> {
        const {logger, languageCode} = options;
        const p = EdificeService.buildFloorListingPipelines(floorIds);
        const [unitsStats, unitsByStatusResult, unitValueByFloor] = await Promise.all([
            unitService.aggregate(p.unitsStatsPipeline, {logger, languageCode}),
            unitService.aggregate(p.unitsByStatusPipeline, {logger, languageCode}),
            unitService.aggregate(p.unitValueByFloorPipeline, {logger, languageCode}),
        ]);
        return {unitsStats, unitsByStatusResult, unitValueByFloor};
    }

    private static rollupListingAggregatesToEdifices(
        edificeIds: ObjectId[],
        floorToEdifice: Map<string, string>,
        agg: FloorListingAggregateRows,
        floorsCountByEdifice: Map<string, number>
    ): Map<string, any> {
        const statisticsMap = new Map<string, any>();
        const {totalValueByEdifice} = EdificeService.initEdificeValueMaps(edificeIds);

        for (const edificeId of edificeIds) {
            const key = edificeId.toString();
            statisticsMap.set(key, {
                totalFloors: floorsCountByEdifice.get(key) || 0,
                totalUnits: 0,
                totalUnitsArea: 0,
                totalUnitsNetArea: 0,
                totalUnitsSharedArea: 0,
                totalValue: [],
                unitsByStatus: EdificeService.emptyUnitsByStatus(),
            });
        }

        for (const stat of agg.unitsStats) {
            const floorId = stat._id?.toString();
            const edificeId = floorId ? floorToEdifice.get(floorId) : undefined;
            if (edificeId) {
                const current = statisticsMap.get(edificeId) || {};
                const totalUnits = (current.totalUnits || 0) + (stat.totalUnits || 0);
                statisticsMap.set(edificeId, {
                    ...current,
                    totalUnits,
                    totalUnitsArea: (current.totalUnitsArea || 0) + (stat.totalUnitsArea || 0),
                    totalUnitsNetArea: (current.totalUnitsNetArea || 0) + (stat.totalUnitsNetArea || 0),
                    totalUnitsSharedArea: (current.totalUnitsSharedArea || 0) + (stat.totalUnitsSharedArea || 0),
                });
            }
        }

        for (const row of agg.unitValueByFloor) {
            const floorId = row._id?.toString();
            const edificeId = floorId ? floorToEdifice.get(floorId) : undefined;
            if (edificeId) EdificeService.addAggCurrencyItems(totalValueByEdifice.get(edificeId)!, row.valueByCurrency);
        }

        for (const row of agg.unitsByStatusResult) {
            const floorId = row._id?.floor?.toString();
            const status = row._id?.status;
            const count = row.count || 0;
            const edificeId = floorId ? floorToEdifice.get(floorId) : undefined;
            if (edificeId && status && STATUS_KEY_MAP[status]) {
                const current = statisticsMap.get(edificeId) || {};
                const unitsByStatus = {...(current.unitsByStatus || EdificeService.emptyUnitsByStatus())};
                const sk = STATUS_KEY_MAP[status];
                unitsByStatus[sk] = (unitsByStatus[sk] || 0) + count;
                statisticsMap.set(edificeId, {...current, unitsByStatus});
            }
        }

        for (const edificeId of edificeIds) {
            const key = edificeId.toString();
            const current = statisticsMap.get(key) || {};
            const tvMap = totalValueByEdifice.get(key) || new Map();
            statisticsMap.set(key, {
                ...current,
                totalValue: EdificeService.currencyAccumMapToDto(tvMap),
            });
        }

        return statisticsMap;
    }

    private static rollupMoneyFromUnitStats(
        unitIdsOnEdifice: string[],
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
        for (const uid of unitIdsOnEdifice) {
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
            collected: EdificeService.mergeEdificeMoneyByCurrency(collectedParts),
            notCollected: EdificeService.mergeEdificeMoneyByCurrency(notCollectedParts),
            verifiedPaidUnitCosts: EdificeService.mergeEdificeMoneyByCurrency(verifiedPaidParts),
            verifiedOutstandingUnitCosts: EdificeService.mergeEdificeMoneyByCurrency(verifiedOutstandingParts),
            pendingVerificationUnitCosts: EdificeService.mergeEdificeMoneyByCurrency(pendingVerificationParts),
            totalUnitCostDocuments,
        };
    }

    /**
     * Sanitizes edifice statistics for the caller's read permissions.
     * Floor and unit listing fields use Floor / Unit schema guards.
     * Collected / not collected are rolled up from unitService.calculateStatistics (already permission-filtered per unit).
     */
    static sanitizeStatistics(statistics: EdificeStatistics & Record<string, unknown>, actionUserCtx: UserContext, languageCode: string): EdificeStatistics {
        const sanitized: EdificeStatistics = {};

        try {
            const floorFields = SchemaGuard.sanitizeFields(Floor, COLLECTED_DATA['floors'].readFields, 'read', actionUserCtx, languageCode);
            if (floorFields && Object.keys(floorFields).length > 0 && statistics.totalFloors !== undefined) {
                sanitized.totalFloors = statistics.totalFloors;
            }
        } catch {
            /* no floor read */
        }

        try {
            const unitFields = SchemaGuard.sanitizeFields(Unit, {area: {}, price: {}, status: {}}, 'read', actionUserCtx, languageCode);
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

    /**
     * Floor polygon coordinates grouped by edifice id.
     * Returns an empty map when the caller lacks Floor `polygonCoordinates` read permission or omits `actionUserCtx` / `languageCode`.
     */
    async getFloorsCoordinatesByEdificeIds(edificeIds: ObjectId[], options: {logger?: any; languageCode?: string; actionUserCtx?: UserContext} = {}): Promise<Record<string, EdificeFloorCoordinateRow[]>> {
        const {logger, languageCode, actionUserCtx} = options;
        const byEdifice: Record<string, EdificeFloorCoordinateRow[]> = {};
        if (edificeIds.length === 0) {
            return byEdifice;
        }
        if (actionUserCtx == null || languageCode == null) {
            return byEdifice;
        }
        try {
            SchemaGuard.sanitizeFields(Floor, {polygonCoordinates: {}}, 'read', actionUserCtx, languageCode);
        } catch {
            return byEdifice;
        }
        const floors = await floorService.find(
            {edifice: {$in: edificeIds}},
            {logger, languageCode},
            null,
            'polygonCoordinates name edifice'
        );
        for (const f of floors as any[]) {
            const eid = f.edifice?.toString?.();
            if (!eid) continue;
            if (!byEdifice[eid]) byEdifice[eid] = [];
            byEdifice[eid].push({
                polygonCoordinates: f.polygonCoordinates?.map((point: {x: number; y: number}) => ({x: point.x, y: point.y})) || [],
                _id: f._id.toString(),
                name: f.name,
            });
        }
        return byEdifice;
    }

    /**
     * Edifice polygon coordinates on the project main image, grouped by project id.
     * Returns an empty map when the caller lacks Edifice `polygonCoordinates` read permission or omits `actionUserCtx` / `languageCode`.
     */
    async getEdificesCoordinatesByProjectIds(projectIds: ObjectId[], options: {logger?: any; languageCode?: string; actionUserCtx?: UserContext} = {}): Promise<Record<string, EdificeProjectCoordinateRow[]>> {
        const {logger, languageCode, actionUserCtx} = options;
        const byProject: Record<string, EdificeProjectCoordinateRow[]> = {};
        if (projectIds.length === 0) {
            return byProject;
        }
        if (actionUserCtx == null || languageCode == null) {
            return byProject;
        }
        try {
            SchemaGuard.sanitizeFields(Edifice, {polygonCoordinates: {}}, 'read', actionUserCtx, languageCode);
        } catch {
            return byProject;
        }
        const edifices = await this.find(
            {project: {$in: projectIds}},
            {logger, languageCode},
            null,
            'polygonCoordinates name project'
        );
        for (const e of edifices as any[]) {
            const pid = e.project?._id != null ? e.project._id.toString() : e.project?.toString?.();
            if (!pid) continue;
            if (!byProject[pid]) byProject[pid] = [];
            byProject[pid].push({
                polygonCoordinates: e.polygonCoordinates?.map((point: {x: number; y: number}) => ({x: point.x, y: point.y})) || [],
                _id: e._id.toString(),
                name: e.name,
            });
        }

        // Also fetch floor coordinates and attach to each edifice entry
        let canReadFloorCoords = false;
        try {
            SchemaGuard.sanitizeFields(Floor, {polygonCoordinates: {}}, 'read', actionUserCtx, languageCode);
            canReadFloorCoords = true;
        } catch {
            /* no floor polygon read permission */
        }

        if (canReadFloorCoords) {
            const allEdificeIds = (edifices as any[]).map((e: any) => e._id);
            if (allEdificeIds.length > 0) {
                const floors = await floorService.find(
                    {edifice: {$in: allEdificeIds}},
                    {logger, languageCode},
                    null,
                    'polygonCoordinates name edifice'
                );
                // Group floors by edifice
                const floorsByEdifice = new Map<string, {_id: string; name: string; polygonCoordinates: {x: number; y: number}[]}[]>();
                for (const f of floors as any[]) {
                    const eid = f.edifice?.toString?.() ?? f.edifice?._id?.toString?.();
                    if (!eid) continue;
                    if (!floorsByEdifice.has(eid)) floorsByEdifice.set(eid, []);
                    floorsByEdifice.get(eid)!.push({
                        polygonCoordinates: f.polygonCoordinates?.map((p: {x: number; y: number}) => ({x: p.x, y: p.y})) || [],
                        _id: f._id.toString(),
                        name: f.name,
                    });
                }
                // Attach to each edifice in byProject
                for (const pid of Object.keys(byProject)) {
                    for (const edificeCoord of byProject[pid]) {
                        const flrs = floorsByEdifice.get(edificeCoord._id);
                        if (flrs && flrs.length > 0) {
                            (edificeCoord as any).floorsCoordinates = flrs;
                        }
                    }
                }
            }
        }

        return byProject;
    }

    /**
     * Calculate edifice statistics and return values sanitized for the user's read permissions.
     */
    async calculateStatistics(edificeIds: ObjectId[], actionUserCtx: UserContext, languageCode: string, logger?: any): Promise<Record<string, EdificeStatistics>> {
        if (edificeIds.length === 0) {
            return {};
        }

        const floors = await floorService.find(
            {edifice: {$in: edificeIds}},
            {logger, languageCode},
            null,
            '_id edifice'
        );
        const floorIds = floors.map((f: any) => f._id);
        const floorToEdifice = new Map<string, string>();
        for (const f of floors) {
            const fid = (f as any)._id?.toString();
            const eid = (f as any).edifice?.toString?.() ?? (f as any).edifice?.toString();
            if (fid && eid) floorToEdifice.set(fid, eid);
        }

        const floorsStatsPipeline = [{$match: {edifice: {$in: edificeIds}}}, {$group: {_id: '$edifice', totalFloors: {$sum: 1}}}];

        const [floorsStats, agg] = await Promise.all([
            floorService.aggregate(floorsStatsPipeline, {logger, languageCode}),
            EdificeService.runFloorListingAggregates(floorIds, {logger, languageCode}),
        ]);

        const floorsCountByEdifice = new Map<string, number>();
        for (const stat of floorsStats) {
            const edificeId = stat._id?.toString();
            if (edificeId) {
                floorsCountByEdifice.set(edificeId, stat.totalFloors || 0);
            }
        }

        const statisticsMap = EdificeService.rollupListingAggregatesToEdifices(edificeIds, floorToEdifice, agg, floorsCountByEdifice);

        const units = await unitService.find({floor: {$in: floorIds}}, {logger, languageCode}, null, '_id floor');
        const unitIdsByEdifice = new Map<string, string[]>();
        const allUnitIds: ObjectId[] = [];
        for (const u of units as any[]) {
            allUnitIds.push(u._id);
            const fid = u.floor?._id != null ? u.floor._id.toString() : u.floor?.toString?.();
            const eid = fid ? floorToEdifice.get(fid) : undefined;
            if (!eid) continue;
            const uid = u._id.toString();
            if (!unitIdsByEdifice.has(eid)) unitIdsByEdifice.set(eid, []);
            unitIdsByEdifice.get(eid)!.push(uid);
        }

        const unitStatsById =
            allUnitIds.length > 0 ? await unitService.calculateStatistics(allUnitIds, actionUserCtx, languageCode, {logger}) : {};

        const result: Record<string, EdificeStatistics> = {};
        for (const edificeId of edificeIds) {
            const key = edificeId.toString();
            const raw = statisticsMap.get(key) || {};
            const unitIdsOnEdifice = unitIdsByEdifice.get(key) || [];
            const rolled = EdificeService.rollupMoneyFromUnitStats(unitIdsOnEdifice, unitStatsById);
            const merged = {
                ...raw,
                collectedAmount: rolled.collected,
                notCollectedAmount: rolled.notCollected,
                ...(rolled.verifiedPaidUnitCosts.length > 0 ? {verifiedPaidUnitCosts: rolled.verifiedPaidUnitCosts} : {}),
                ...(rolled.verifiedOutstandingUnitCosts.length > 0 ? {verifiedOutstandingUnitCosts: rolled.verifiedOutstandingUnitCosts} : {}),
                ...(rolled.pendingVerificationUnitCosts.length > 0 ? {pendingVerificationUnitCosts: rolled.pendingVerificationUnitCosts} : {}),
                totalUnitCostDocuments: rolled.totalUnitCostDocuments,
            };
            result[key] = EdificeService.sanitizeStatistics(merged, actionUserCtx, languageCode);
        }
        return result;
    }
}

export const edificeService = new EdificeService();
