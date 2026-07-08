/**
 * ROI Calculator API
 *
 * Aggregates UnitCost totals against sale prices and rental revenue
 * to produce ROI metrics per unit and for the active filter scope.
 *
 * Scope narrows progressively: project → edifice(s) → floor(s) → unit(s).
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import Unit from "../../../database/schemas/unit/unit";
import UnitCost from "../../../database/schemas/unitCost/unitCost";
import Sale from "../../../database/schemas/sale/sale";
import Lease from "../../../database/schemas/lease/lease";
import Project from "../../../database/schemas/project/project";
import Edifice from "../../../database/schemas/edifice/edifice";
import Floor from "../../../database/schemas/floor/floor";
import type {RoiRequest} from "armonia/src/modules/propertyManagement/api/realEstate/private/roi/roi.request.type";
import type {
    RoiResponse,
    RoiUnitBreakdown,
    RoiProjectSummary,
    RoiScopeType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/roi/roi.response.type";

export const basePath = "/api/realEstate/roi";
export const router   = Router();

function toIdArray(ids?: string | string[]): string[] {
    if (!ids) return [];
    const arr = Array.isArray(ids) ? ids : [ids];
    return arr.filter((id) => typeof id === "string" && ObjectId.isValid(id));
}

function toObjectIds(ids: string[]): ObjectId[] {
    return ids.map((id) => new ObjectId(id));
}

function pluralLabel(count: number, singular: string, plural: string): string {
    return count === 1 ? singular : `${count} ${plural}`;
}

async function resolveScopeLabel(
    scopeType: RoiScopeType,
    companyId: ObjectId,
    projectId: string | undefined,
    edificeIds: string[],
    floorIds: string[],
    unitIds: string[],
    units: {unitName?: string}[],
): Promise<{scopeType: RoiScopeType; scopeLabel: string; projectName: string}> {
    let projectName = "";

    if (projectId && ObjectId.isValid(projectId)) {
        const proj = await Project.findOne({_id: new ObjectId(projectId), company: companyId})
            .select("name")
            .lean() as {name?: string} | null;
        projectName = proj?.name ?? "";
    }

    if (scopeType === "unit") {
        if (unitIds.length === 1 && units.length === 1) {
            return {scopeType, scopeLabel: units[0].unitName ?? "Unit", projectName};
        }
        return {scopeType, scopeLabel: pluralLabel(unitIds.length, "Unit", "units"), projectName};
    }

    if (scopeType === "floor") {
        const floors = await Floor.find({_id: {$in: toObjectIds(floorIds)}, company: companyId})
            .select("name")
            .lean() as {name?: string}[];
        if (floors.length === 1) {
            return {scopeType, scopeLabel: floors[0].name ?? "Floor", projectName};
        }
        return {scopeType, scopeLabel: pluralLabel(floors.length, "Floor", "floors"), projectName};
    }

    if (scopeType === "edifice") {
        const edifices = await Edifice.find({_id: {$in: toObjectIds(edificeIds)}, company: companyId})
            .select("name")
            .lean() as {name?: string}[];
        if (edifices.length === 1) {
            return {scopeType, scopeLabel: edifices[0].name ?? "Edifice", projectName};
        }
        return {scopeType, scopeLabel: pluralLabel(edifices.length, "Edifice", "edifices"), projectName};
    }

    return {scopeType: "project", scopeLabel: projectName || "Project", projectName};
}

function resolveScopeType(edificeIds: string[], floorIds: string[], unitIds: string[]): RoiScopeType {
    if (unitIds.length > 0) return "unit";
    if (floorIds.length > 0) return "floor";
    if (edificeIds.length > 0) return "edifice";
    return "project";
}

// POST /api/realEstate/roi
// Body: { projectId?, edificeIds?, floorIds?, unitIds? }
router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType & RoiRequest) => {
        const {company} = params;
        const companyId = company._id as ObjectId;

        const projectId  = typeof params.projectId === "string" && ObjectId.isValid(params.projectId)
            ? params.projectId
            : undefined;
        const edificeIds = toIdArray(params.edificeIds);
        const floorIds   = toIdArray(params.floorIds);
        const unitIds    = toIdArray(params.unitIds);

        if (!projectId && unitIds.length === 0) {
            return {message: "projectId or unitIds is required"};
        }

        const scopeType = resolveScopeType(edificeIds, floorIds, unitIds);

        // ── Build unit filter (progressive narrowing) ─────────────────────────────
        const unitFilter: Record<string, any> = {company: companyId, deletedAt: null};
        if (projectId) unitFilter.project = new ObjectId(projectId);
        if (edificeIds.length > 0) unitFilter.edifice = {$in: toObjectIds(edificeIds)};
        if (floorIds.length > 0)   unitFilter.floor   = {$in: toObjectIds(floorIds)};
        if (unitIds.length > 0)    unitFilter._id     = {$in: toObjectIds(unitIds)};

        const units = await Unit.find(unitFilter)
            .select("_id name unitNumber status price priceCurrency project")
            .populate("priceCurrency", "symbol abbreviation")
            .lean();

        const matchedUnitIds = units.map((u: any) => u._id);

        // ── Aggregate costs per unit ──────────────────────────────────────────────
        const costAgg = await UnitCost.aggregate([
            {$match: {unit: {$in: matchedUnitIds}, company: companyId, deletedAt: null}},
            {$unwind: {path: "$expenditureItems", preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: "$unit",
                    totalCost: {
                        $sum: {
                            $cond: [
                                {$and: [{$ifNull: ["$expenditureItems", false]}, {$gt: ["$expenditureItems.pricePerUnit", 0]}]},
                                {$multiply: ["$expenditureItems.amount", {$toDouble: "$expenditureItems.pricePerUnit"}]},
                                {$toDouble: {$ifNull: ["$totalAmount", 0]}},
                            ],
                        },
                    },
                    currencySymbol: {$first: "$currency"},
                },
            },
        ]);
        const costByUnit: Record<string, number> = {};
        for (const row of costAgg) {
            costByUnit[row._id.toString()] = row.totalCost ?? 0;
        }

        // ── Fetch sales for sold units ─────────────────────────────────────────────
        const sales = await Sale.find({unit: {$in: matchedUnitIds}, company: companyId, deletedAt: null})
            .select("unit finalPrice saleCurrency")
            .populate("saleCurrency", "symbol")
            .lean();
        const saleByUnit: Record<string, {price: number; symbol?: string}> = {};
        for (const sale of sales as any[]) {
            const uid = (sale.unit as any)?.toString() ?? sale.unit.toString();
            saleByUnit[uid] = {
                price:  sale.finalPrice ? parseFloat(sale.finalPrice.toString()) : 0,
                symbol: sale.saleCurrency?.symbol,
            };
        }

        // ── Fetch active leases for rented units ──────────────────────────────────
        const leases = await Lease.find({unit: {$in: matchedUnitIds}, company: companyId, deletedAt: null, status: "active"})
            .select("unit monthlyRent rentCurrency")
            .populate("rentCurrency", "symbol")
            .lean();
        const rentByUnit: Record<string, {monthly: number; symbol?: string}> = {};
        for (const lease of leases as any[]) {
            const uid = (lease.unit as any)?.toString() ?? lease.unit.toString();
            rentByUnit[uid] = {
                monthly: lease.monthlyRent ? parseFloat(lease.monthlyRent.toString()) : 0,
                symbol:  lease.rentCurrency?.symbol,
            };
        }

        // ── Build per-unit breakdown ───────────────────────────────────────────────
        const unitBreakdowns: RoiUnitBreakdown[] = units.map((u: any) => {
            const uid         = u._id.toString();
            const costs       = costByUnit[uid] ?? 0;
            const sale        = saleByUnit[uid];
            const rent        = rentByUnit[uid];
            const salePrice   = sale?.price;
            const monthlyRent = rent?.monthly;
            const netProfit   = salePrice !== undefined ? salePrice - costs : undefined;
            const roiPercent  = netProfit !== undefined && costs > 0 ? (netProfit / costs) * 100 : undefined;
            const annualGrossYield = monthlyRent && salePrice && salePrice > 0
                ? ((monthlyRent * 12) / salePrice) * 100
                : undefined;

            return {
                unitId:         uid,
                unitName:       u.name,
                unitNumber:     u.unitNumber,
                status:         u.status,
                salePrice,
                saleCurrencySymbol: sale?.symbol ?? u.priceCurrency?.symbol,
                totalCosts:     costs,
                costCurrencySymbol: u.priceCurrency?.symbol,
                netProfit,
                roiPercent,
                monthlyRent,
                annualGrossYield,
            };
        });

        // ── Scope summary (aggregated over matched units) ─────────────────────────
        let projectSummary: RoiProjectSummary | undefined;
        const effectiveProjectId = projectId
            ?? (units[0] as any)?.project?.toString?.()
            ?? (units[0] as any)?.project?.toString();

        if (effectiveProjectId && ObjectId.isValid(effectiveProjectId)) {
            const {scopeLabel, projectName} = await resolveScopeLabel(
                scopeType,
                companyId,
                effectiveProjectId,
                edificeIds,
                floorIds,
                unitIds,
                unitBreakdowns,
            );

            const totalRevenue = unitBreakdowns.reduce((s, u) => s + (u.salePrice ?? 0), 0);
            const totalCosts   = unitBreakdowns.reduce((s, u) => s + u.totalCosts, 0);
            const netProfit    = totalRevenue - totalCosts;
            const roiPercent   = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
            const withRoi      = unitBreakdowns.filter(u => u.roiPercent !== undefined);
            const avgRoi       = withRoi.length
                ? withRoi.reduce((s, u) => s + (u.roiPercent ?? 0), 0) / withRoi.length
                : 0;

            projectSummary = {
                scopeType,
                scopeLabel,
                projectId:          effectiveProjectId,
                projectName,
                totalUnits:         units.length,
                soldUnits:          unitBreakdowns.filter(u => u.status === "sold_unit").length,
                availableUnits:     unitBreakdowns.filter(u => u.status === "available_unit").length,
                rentedUnits:        unitBreakdowns.filter(u => u.status === "rented_unit").length,
                totalRevenue,
                totalCosts,
                netProfit,
                roiPercent,
                averageRoiPercent:  avgRoi,
            };
        }

        const response: RoiResponse = {
            project:     projectSummary,
            units:       unitBreakdowns,
            computedAt:  new Date().toISOString(),
        };

        return response;
    })
);
