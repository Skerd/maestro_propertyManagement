/**
 * Project Service
 * 
 * CRUD service for Project model.
 */

import {ObjectId} from 'mongodb';
import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import {edificeService} from '../edifice/edifice.service';
import {floorService} from '../floor/floor.service';
import {unitService} from '../unit/unit.service';
import {ProjectStatistics} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/project.dto";
import type {
    EdificeMoneyByCurrency,
    EdificeStatistics
} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto";
import {UserContext} from "@coreModule/utilities/types/types";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import Edifice from "../edifice/edifice";
import {COLLECTED_DATA} from "@coreModule/database/collections";
import Floor from "../floor/floor";
import Unit from "../unit/unit";
import Project, {IProject} from "./project";
import type {ClientSession, FilterQuery} from "mongoose";
import {addMoneyLines, aggregateCurrencyFields, moneyRowsOf, type MoneyTotals, sumMoneyRows} from "../../../utilities/statistics/moneyTotals";

export class ProjectService extends BaseCrudService<IProject, typeof Project> {
    constructor() {
        super(Project, 'Project');
    }

    private static emptyUnitsByStatus() {
        return {available: 0, reserved: 0, sold: 0, unavailable: 0, leased: 0};
    }

    /**
     * Sums listing-style edifice statistics (already sanitized per edifice) into project-level partial stats.
     * Does not replace totalFloors / totalUnits from project aggregates — only adds listing rollup fields.
     */
    private static rollupListingStatsFromEdifices(edificeStatsList: EdificeStatistics[]): Partial<ProjectStatistics> {
        if (edificeStatsList.length === 0) {
            return {};
        }
        let totalUnitsArea = 0;
        let totalUnitsNetArea = 0;
        let totalUnitsSharedArea = 0;
        const us = ProjectService.emptyUnitsByStatus();
        const totalValueParts: EdificeMoneyByCurrency[] = [];
        const collectedParts: EdificeMoneyByCurrency[] = [];
        const notCollectedParts: EdificeMoneyByCurrency[] = [];
        const verifiedPaidParts: EdificeMoneyByCurrency[] = [];
        const verifiedOutstandingParts: EdificeMoneyByCurrency[] = [];
        const pendingVerificationParts: EdificeMoneyByCurrency[] = [];
        let totalUnitCostDocuments = 0;

        for (const s of edificeStatsList) {
            totalUnitsArea += s.totalUnitsArea ?? 0;
            totalUnitsNetArea += s.totalUnitsNetArea ?? 0;
            totalUnitsSharedArea += s.totalUnitsSharedArea ?? 0;
            totalUnitCostDocuments += s.totalUnitCostDocuments ?? 0;
            if (s.unitsByStatus) {
                us.available += s.unitsByStatus.available ?? 0;
                us.reserved += s.unitsByStatus.reserved ?? 0;
                us.sold += s.unitsByStatus.sold ?? 0;
                us.unavailable += s.unitsByStatus.unavailable ?? 0;
                us.leased += s.unitsByStatus.leased ?? 0;
            }
            if (s.totalValue?.length) {
                totalValueParts.push(...s.totalValue);
            }
            if (s.collectedAmount?.length) {
                collectedParts.push(...s.collectedAmount);
            }
            if (s.notCollectedAmount?.length) {
                notCollectedParts.push(...s.notCollectedAmount);
            }
            if (s.verifiedPaidUnitCosts?.length) {
                verifiedPaidParts.push(...s.verifiedPaidUnitCosts);
            }
            if (s.verifiedOutstandingUnitCosts?.length) {
                verifiedOutstandingParts.push(...s.verifiedOutstandingUnitCosts);
            }
            if (s.pendingVerificationUnitCosts?.length) {
                pendingVerificationParts.push(...s.pendingVerificationUnitCosts);
            }
        }

        const mergedValue = sumMoneyRows(totalValueParts);
        const mergedCollected = sumMoneyRows(collectedParts);
        const mergedNotCollected = sumMoneyRows(notCollectedParts);
        const mergedVerifiedPaid = sumMoneyRows(verifiedPaidParts);
        const mergedVerifiedOutstanding = sumMoneyRows(verifiedOutstandingParts);
        const mergedPendingVerification = sumMoneyRows(pendingVerificationParts);

        return {
            totalUnitsArea,
            totalUnitsNetArea,
            totalUnitsSharedArea,
            unitsByStatus: us,
            ...(mergedValue.length > 0 ? {totalValue: mergedValue} : {}),
            ...(mergedCollected.length > 0 ? {collectedAmount: mergedCollected} : {}),
            notCollectedAmount: mergedNotCollected,
            ...(mergedVerifiedPaid.length > 0 ? {verifiedPaidUnitCosts: mergedVerifiedPaid} : {}),
            ...(mergedVerifiedOutstanding.length > 0 ? {verifiedOutstandingUnitCosts: mergedVerifiedOutstanding} : {}),
            ...(mergedPendingVerification.length > 0 ? {pendingVerificationUnitCosts: mergedPendingVerification} : {}),
            totalUnitCostDocuments,
        };
    }

    /**
     * Sanitizes statistics based on read permissions for Floor, Unit, area sources, and Edifice investment.
     */
    static sanitizeStatistics(statistics: ProjectStatistics, actionUserCtx: UserContext, languageCode: string): ProjectStatistics {
        const sanitized: ProjectStatistics = {};

        try {
            const floorFields = SchemaGuard.sanitizeFields(Floor, COLLECTED_DATA["floors"].readFields, "read", actionUserCtx, languageCode);
            if (floorFields && Object.keys(floorFields).length > 0 && statistics.totalFloors !== undefined) {
                sanitized.totalFloors = statistics.totalFloors;
            }
        } catch (_) {
            // User doesn't have permission to read floors - field not included
        }

        try {
            const unitFields = SchemaGuard.sanitizeFields(Unit, COLLECTED_DATA["units"].readFields, "read", actionUserCtx, languageCode);
            if (unitFields && Object.keys(unitFields).length > 0 && statistics.totalUnits !== undefined) {
                sanitized.totalUnits = statistics.totalUnits;
            }
        } catch (_) {
            // User doesn't have permission to read units - field not included
        }

        let canReadArea = false;
        try {
            const floorAreaFields = SchemaGuard.sanitizeFields(Floor, {area: {}}, "read", actionUserCtx, languageCode);
            if (floorAreaFields && floorAreaFields.area) {
                canReadArea = true;
            }
        } catch (_) {
            try {
                const unitAreaFields = SchemaGuard.sanitizeFields(Unit, {area: {}}, "read", actionUserCtx, languageCode);
                if (unitAreaFields && unitAreaFields.area) {
                    canReadArea = true;
                }
            } catch (_) {
                try {
                    const edificeAreaFields = SchemaGuard.sanitizeFields(Edifice, {totalArea: {}}, "read", actionUserCtx, languageCode);
                    if (edificeAreaFields && edificeAreaFields.totalArea) {
                        canReadArea = true;
                    }
                } catch (_) {
                    // User doesn't have permission to read area - field not included
                }
            }
        }
        if (canReadArea && statistics.totalArea !== undefined) {
            sanitized.totalArea = statistics.totalArea;
        }

        try {
            const edificeInvestmentFields = SchemaGuard.sanitizeFields(
                Edifice,
                {investmentValue: {}},
                "read",
                actionUserCtx,
                languageCode
            );
            if (
                edificeInvestmentFields &&
                edificeInvestmentFields.investmentValue &&
                statistics.totalInvestmentValue !== undefined
            ) {
                sanitized.totalInvestmentValue = statistics.totalInvestmentValue;
            }
        } catch (_) {
            // User doesn't have permission to read investment value - field not included
        }

        try {
            const edificeFields = SchemaGuard.sanitizeFields(
                Edifice,
                COLLECTED_DATA["edifices"].readFields,
                "read",
                actionUserCtx,
                languageCode
            );
            if (
                edificeFields &&
                Object.keys(edificeFields).length > 0 &&
                statistics.totalEdifices !== undefined
            ) {
                sanitized.totalEdifices = statistics.totalEdifices;
            }
        } catch (_) {
            // User doesn't have permission to read edifices - count not included
        }

        // Listing aggregates rolled up from edifice statistics (align with EdificeService.sanitizeStatistics).
        try {
            const unitListingFields = SchemaGuard.sanitizeFields(
                Unit,
                {area: {}, price: {}, status: {}},
                "read",
                actionUserCtx,
                languageCode
            );
            if (unitListingFields && Object.keys(unitListingFields).length > 0) {
                if (unitListingFields.area && statistics.totalUnitsArea !== undefined) {
                    sanitized.totalUnitsArea = statistics.totalUnitsArea;
                }
                if (unitListingFields.area && statistics.totalUnitsNetArea !== undefined) {
                    sanitized.totalUnitsNetArea = statistics.totalUnitsNetArea;
                }
                if (unitListingFields.area && statistics.totalUnitsSharedArea !== undefined) {
                    sanitized.totalUnitsSharedArea = statistics.totalUnitsSharedArea;
                }
                if (unitListingFields.price && statistics.totalValue !== undefined) {
                    sanitized.totalValue = statistics.totalValue;
                }
                if (unitListingFields.status && statistics.unitsByStatus) {
                    sanitized.unitsByStatus = statistics.unitsByStatus;
                }
            }
        } catch (_) {
            /* no unit listing read */
        }

        if (statistics.collectedAmount && Array.isArray(statistics.collectedAmount) && statistics.collectedAmount.length > 0) {
            sanitized.collectedAmount = statistics.collectedAmount;
        }
        if (statistics.notCollectedAmount !== undefined) {
            sanitized.notCollectedAmount = statistics.notCollectedAmount;
        }
        if (statistics.verifiedPaidUnitCosts?.length) {
            sanitized.verifiedPaidUnitCosts = statistics.verifiedPaidUnitCosts;
        }
        if (statistics.verifiedOutstandingUnitCosts?.length) {
            sanitized.verifiedOutstandingUnitCosts = statistics.verifiedOutstandingUnitCosts;
        }
        if (statistics.pendingVerificationUnitCosts?.length) {
            sanitized.pendingVerificationUnitCosts = statistics.pendingVerificationUnitCosts;
        }
        if (statistics.totalUnitCostDocuments !== undefined) {
            sanitized.totalUnitCostDocuments = statistics.totalUnitCostDocuments;
        }

        return sanitized;
    }

    /**
     * Calculate project statistics (floors, units, area, investment values)
     * Returns projectId -> statistics (sanitized for read permissions).
     */
    async calculateStatistics(projectIds: ObjectId[], actionUserCtx: UserContext, languageCode: string, logger?: any): Promise<Record<string, ProjectStatistics>> {

        const statisticsByProjectId: Record<string, ProjectStatistics> = {};

        for (const projectId of projectIds) {
            statisticsByProjectId[projectId.toString()] = {
                totalEdifices: 0,
                totalFloors: 0,
                totalUnits: 0,
                totalArea: 0,
                totalInvestmentValue: []
            };
        }
        if (projectIds.length === 0) {
            return statisticsByProjectId;
        }

        const edificeStatsPipeline = [
            {
                $match: {
                    project: { $in: projectIds }
                }
            },
            {
                $lookup: {
                    from: "currencies",
                    localField: "investmentCurrency",
                    foreignField: "_id",
                    as: "currencyInfo"
                }
            },
            {
                $unwind: {
                    path: "$currencyInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: {
                        project: "$project",
                        currency: "$investmentCurrency"
                    },
                    totalArea: { $sum: "$totalArea" },
                    totalInvestmentValue: { $sum: { $toDecimal: { $ifNull: ["$investmentValue", 0] } } },
                    currencyInfo: { $first: "$currencyInfo" }
                }
            },
            {
                $group: {
                    _id: "$_id.project",
                    totalArea: { $sum: "$totalArea" },
                    investmentByCurrency: {
                        $push: {
                            currencyId: "$_id.currency",
                            ...aggregateCurrencyFields("currencyInfo"),
                            value: "$totalInvestmentValue"
                        }
                    }
                }
            }
        ];

        const floorsStatsPipeline = [
            {
                $match: {
                    edifice: { $exists: true }
                }
            },
            {
                $lookup: {
                    from: "edifices",
                    localField: "edifice",
                    foreignField: "_id",
                    as: "edificeInfo",
                    pipeline: [
                        {
                            // The soft-delete hook filters only the outer pipeline (DB-04).
                            $match: {
                                project: { $in: projectIds },
                                deletedAt: null
                            }
                        },
                        {
                            $project: {
                                project: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$edificeInfo"
            },
            {
                $group: {
                    _id: "$edificeInfo.project",
                    totalFloors: { $sum: 1 }
                }
            }
        ];

        const unitsStatsPipeline = [
            {
                $match: {
                    project: { $in: projectIds }
                }
            },
            {
                $group: {
                    _id: "$project",
                    totalUnits: { $sum: 1 }
                }
            }
        ];

        const edificeCountPipeline = [
            {
                $match: {
                    project: { $in: projectIds }
                }
            },
            {
                $group: {
                    _id: "$project",
                    totalEdifices: { $sum: 1 }
                }
            }
        ];

        const [floorsStats, unitsStats, edificeStats, edificeCounts] = await Promise.all([
            floorService.aggregate(floorsStatsPipeline, { logger, languageCode }),
            unitService.aggregate(unitsStatsPipeline, { logger, languageCode }),
            edificeService.aggregate(edificeStatsPipeline, { logger, languageCode }),
            edificeService.aggregate(edificeCountPipeline, { logger, languageCode })
        ]);

        // Process floors statistics
        for (const stat of floorsStats) {
            const projectId = stat._id?.toString();
            if (projectId) {
                statisticsByProjectId[projectId] = {
                    ...(statisticsByProjectId[projectId] || {}),
                    totalFloors: stat.totalFloors || 0
                };
            }
        }

        // Process units statistics
        for (const stat of unitsStats) {
            const projectId = stat._id?.toString();
            if (projectId) {
                statisticsByProjectId[projectId] = {
                    ...(statisticsByProjectId[projectId] || {}),
                    totalUnits: stat.totalUnits || 0,
                };
            }
        }

        for (const stat of edificeCounts) {
            const projectId = stat._id?.toString();
            if (projectId) {
                statisticsByProjectId[projectId] = {
                    ...(statisticsByProjectId[projectId] || {}),
                    totalEdifices: stat.totalEdifices || 0
                };
            }
        }

        // Process edifices statistics
        for (const stat of edificeStats) {
            const projectId = stat._id?.toString();
            if (projectId) {
                const investments: MoneyTotals = new Map();
                addMoneyLines(investments, stat.investmentByCurrency);
                statisticsByProjectId[projectId] = {
                    ...(statisticsByProjectId[projectId] || {}),
                    totalArea: stat.totalArea || 0,
                    totalInvestmentValue: moneyRowsOf(investments)
                };
            }
        }

        const edificesOfProjects = await edificeService.find(
            {project: {$in: projectIds}},
            {logger, languageCode},
            null,
            "_id project"
        );
        const edificeIdsByProject = new Map<string, ObjectId[]>();
        const allEdificeIdsForListing: ObjectId[] = [];
        for (const e of edificesOfProjects as any[]) {
            const pid = e.project?._id != null ? e.project._id.toString() : e.project?.toString?.();
            if (!pid) {
                continue;
            }
            if (!edificeIdsByProject.has(pid)) {
                edificeIdsByProject.set(pid, []);
            }
            edificeIdsByProject.get(pid)!.push(e._id);
            allEdificeIdsForListing.push(e._id);
        }

        let edificeStatsById: Record<string, EdificeStatistics> = {};
        if (allEdificeIdsForListing.length > 0) {
            edificeStatsById = await edificeService.calculateStatistics(
                allEdificeIdsForListing,
                actionUserCtx,
                languageCode,
                logger
            );
        }

        for (const projectId of projectIds) {
            const key = projectId.toString();
            const eids = edificeIdsByProject.get(key) ?? [];
            if (eids.length === 0) {
                continue;
            }
            const perEdificeStats = eids.map((eid) => edificeStatsById[eid.toString()] ?? {});
            const listingRollup = ProjectService.rollupListingStatsFromEdifices(perEdificeStats);
            statisticsByProjectId[key] = {
                ...statisticsByProjectId[key],
                ...listingRollup,
            };
        }

        for (const projectId of Object.keys(statisticsByProjectId)) {
            statisticsByProjectId[projectId] = ProjectService.sanitizeStatistics(
                statisticsByProjectId[projectId],
                actionUserCtx,
                languageCode
            );
        }

        return statisticsByProjectId;
    }

    /** A project's name, as a plain object. */
    findNameLean(filter: FilterQuery<IProject>) {
        return this.model.findOne(filter)
            .select("name")
            .lean();
    }

    /** The matching projects' names, as plain objects. */
    findNamesLean(filter: FilterQuery<IProject>) {
        return this.model.find(filter).select("name").lean<{name?: string}[]>();
    }

    /** A live project's name, as a plain object. */
    findLiveNameLean(filter: FilterQuery<IProject>) {
        return this.model.findOne(filter).noDeleted().select("name").lean();
    }

    /**
     * The company's projects the platform hid after a report (D191), whose units leave the public too: public unit reads
     * add `project: {$nin: …}`.
     */
    async hiddenByPlatformIds(company: ObjectId): Promise<ObjectId[]> {
        const rows = await this.model.find({company, hiddenByPlatform: true}).select("_id").lean<{_id: ObjectId}[]>();
        return rows.map((row) => row._id);
    }

    /** A live project as the platform's report desk reads it (D191): by its id alone, whichever company owns it. */
    findReportable(id: ObjectId, session?: ClientSession) {
        return this.model.findOne({_id: id, deletedAt: null})
            .select("company name hiddenByPlatform")
            .session(session ?? null)
            .lean<{_id: ObjectId; company: ObjectId; name: string; hiddenByPlatform?: boolean}>();
    }
}

export const projectService = new ProjectService();

