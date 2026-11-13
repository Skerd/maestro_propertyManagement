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
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
    collectedFieldReader,
} from "@propertyManagement/utilities/security/canReadCollectedFields";

import {unitCostService} from "../../../database/schemas/unitCost/unitCost.service";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import {floorService} from "@propertyManagement/database/schemas/floor/floor.service";
import {edificeService} from "@propertyManagement/database/schemas/edifice/edifice.service";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {leaseService} from "@propertyManagement/database/schemas/lease/lease.service";
import {currencyDecimals, unitCostTotalsByUnit} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.dto";
import {decimalToNumber, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {type RoiCurrencyAmount, roiTotalsByCurrency, unitGrossYield, unitNetProfit} from "@propertyManagement/utilities/roi/roiCurrencyTotals";
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
        const proj = await projectService.findNameLean({_id: new ObjectId(projectId), company: companyId}) as {name?: string} | null;
        projectName = proj?.name ?? "";
    }

    if (scopeType === "unit") {
        if (unitIds.length === 1 && units.length === 1) {
            return {scopeType, scopeLabel: units[0].unitName ?? "Unit", projectName};
        }
        return {scopeType, scopeLabel: pluralLabel(unitIds.length, "Unit", "units"), projectName};
    }

    if (scopeType === "floor") {
        const floors = await floorService.findNamesLean({_id: {$in: toObjectIds(floorIds)}, company: companyId}) as {name?: string}[];
        if (floors.length === 1) {
            return {scopeType, scopeLabel: floors[0].name ?? "Floor", projectName};
        }
        return {scopeType, scopeLabel: pluralLabel(floors.length, "Floor", "floors"), projectName};
    }

    if (scopeType === "edifice") {
        const edifices = await edificeService.findNamesLean({_id: {$in: toObjectIds(edificeIds)}, company: companyId}) as {name?: string}[];
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
        const {company, actionUserCtx, languageCode} = params;
        const canReadUnits = canReadCollectedFields("units", actionUserCtx, languageCode);
        const canReadUnitCosts = canReadCollectedFields("unitcosts", actionUserCtx, languageCode);
        const canReadSales = canReadCollectedFields("sales", actionUserCtx, languageCode);
        const canReadLeases = canReadCollectedFields("leases", actionUserCtx, languageCode);
        assertAnyCollectedRead(canReadUnits || canReadUnitCosts || canReadSales || canReadLeases, languageCode);
        // Field-level read (SEC-09): a figure is computed only from fields the caller may read.
        const read = collectedFieldReader(actionUserCtx, languageCode);
        const costsReadable = canReadUnitCosts && read("unitcosts", "unit") && read("unitcosts", "expenditureItems");
        const salePriceReadable = canReadSales && read("sales", "unit") && read("sales", "finalPrice");
        const saleCurrencyReadable = read("sales", "saleCurrency");
        const unitCurrencyReadable = read("units", "priceCurrency");
        const costCurrencyReadable = read("unitcosts", "currency");
        const rentReadable = canReadLeases && read("leases", "unit") && read("leases", "status") && read("leases", "monthlyRent");
        const rentCurrencyReadable = read("leases", "rentCurrency");
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
        const unitFilter: Record<string, any> = {company: companyId};
        if (projectId) unitFilter.project = new ObjectId(projectId);
        if (edificeIds.length > 0) unitFilter.edifice = {$in: toObjectIds(edificeIds)};
        if (floorIds.length > 0)   unitFilter.floor   = {$in: toObjectIds(floorIds)};
        if (unitIds.length > 0)    unitFilter._id     = {$in: toObjectIds(unitIds)};

        const units = canReadUnits
            ? await unitService.findForRoi(unitFilter)
            : [];

        const matchedUnitIds = units.map((u: any) => u._id);

        // ── Costs per unit: quantity × unit price per expenditure row, summed per currency at its precision (D35, TD-B213) ──
        // The currency is always read for its precision; its symbol is shown only to a caller who may read it.
        const unitCosts = costsReadable && matchedUnitIds.length > 0
            ? await unitCostService.find(
                {unit: {$in: matchedUnitIds}, company: companyId},
                {logger: params.logger, languageCode, withDeleted: false},
                [{path: "currency", select: costCurrencyReadable ? "symbol decimalPlaces" : "decimalPlaces"}],
                "unit currency expenditureItems",
            )
            : [];
        const costsByUnit = unitCostTotalsByUnit(unitCosts);

        // ── Fetch sales for sold units ─────────────────────────────────────────────
        const sales = salePriceReadable && matchedUnitIds.length > 0
            ? await saleService.findForRoi({unit: {$in: matchedUnitIds}, company: companyId})
            : [];
        // The sale's currency is always read to keep amounts per currency (TD-B223); its symbol only when readable.
        const saleByUnit: Record<string, RoiCurrencyAmount> = {};
        for (const sale of sales as any[]) {
            const uid = (sale.unit as any)?.toString() ?? sale.unit.toString();
            saleByUnit[uid] = {
                currencyId:     String(nestedEntityToRef(sale.saleCurrency) ?? ""),
                amount:         decimalToNumber(sale.finalPrice) ?? 0,
                decimals:       currencyDecimals(sale.saleCurrency),
                currencySymbol: saleCurrencyReadable ? sale.saleCurrency?.symbol : undefined,
            };
        }

        // ── Fetch active leases for rented units ──────────────────────────────────
        const leases = rentReadable && matchedUnitIds.length > 0
            ? await leaseService.findForRoi({unit: {$in: matchedUnitIds}, company: companyId, status: "active"})
            : [];
        // The rent's currency is always read to compare it with the sale's (TD-B227) and for its precision (TD-F103);
        // its symbol only when readable.
        const rentByUnit: Record<string, RoiCurrencyAmount> = {};
        for (const lease of leases as any[]) {
            const uid = (lease.unit as any)?.toString() ?? lease.unit.toString();
            rentByUnit[uid] = {
                currencyId:     String(nestedEntityToRef(lease.rentCurrency) ?? ""),
                amount:         decimalToNumber(lease.monthlyRent) ?? 0,
                decimals:       currencyDecimals(lease.rentCurrency),
                currencySymbol: rentCurrencyReadable ? lease.rentCurrency?.symbol : undefined,
            };
        }

        // ── Build per-unit breakdown ───────────────────────────────────────────────
        const unitBreakdowns: RoiUnitBreakdown[] = units.map((u: any) => {
            const uid         = u._id.toString();
            const unitCurrencySymbol = unitCurrencyReadable ? u.priceCurrency?.symbol : undefined;
            const costs       = costsByUnit.get(uid) ?? [];
            const sale        = saleByUnit[uid];
            const rent        = rentByUnit[uid];
            // Only the sale's own currency names the sale price and net profit: the unit's may be another (TD-B231).
            const saleCurrencySymbol = sale?.currencySymbol;
            const {netProfit, roiPercent} = unitNetProfit(sale, costs);

            return {
                unitId:         uid,
                unitName:       u.name,
                unitNumber:     u.unitNumber,
                status:         u.status,
                // Sale price, net profit and rent each carry their currency's decimals (TD-F103).
                salePrice:      sale ? {amount: sale.amount, decimals: sale.decimals, currencySymbol: saleCurrencySymbol} : undefined,
                // One line per currency; costs in a single unpopulated currency keep the unit's symbol, as before.
                costs: costs.map((cost) => ({
                    amount:         cost.amount,
                    decimals:       cost.decimals,
                    currencySymbol: cost.currencySymbol ?? (costs.length === 1 ? unitCurrencySymbol : undefined),
                })),
                netProfit:      netProfit ? {...netProfit, currencySymbol: saleCurrencySymbol} : undefined,
                roiPercent,
                monthlyRent:    rent ? {amount: rent.amount, decimals: rent.decimals, currencySymbol: rent.currencySymbol} : undefined,
                annualGrossYield: unitGrossYield(sale, rent),
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
                // Sales and costs of the matched units, summed within each currency only (TD-B223).
                totals:             roiTotalsByCurrency(units.map((u: any) => ({
                    sale:  saleByUnit[u._id.toString()],
                    costs: costsByUnit.get(u._id.toString()) ?? [],
                }))),
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
