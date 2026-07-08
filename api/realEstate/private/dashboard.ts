/**
 * Real Estate Dashboard API – statistics endpoint.
 *
 * Mounted under `/api/realEstate/dashboard`. Returns dashboard statistics scoped by company.
 *
 * **Routes:**
 * - `POST ""` – Dashboard stats (summary, revenueByPeriod, salesByPeriod, recentSales, comparisons).
 *
 * @module f_endpoints/realEstate/realEstate/dashboard
 */

import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {edificeService} from "../../../database/schemas/edifice/edifice.service";
import {floorService} from "../../../database/schemas/floor/floor.service";
import {inspectionService} from "../../../database/schemas/inspection/inspection.service";
import {
    modificationRequestService
} from "../../../database/schemas/modificationRequest/modificationRequest.service";
import {paymentPlanService} from "../../../database/schemas/paymentPlan/paymentPlan.service";
import {reservationService} from "../../../database/schemas/reservation/reservation.service";
import {saleService} from "../../../database/schemas/sale/sale.service";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {projectService} from "../../../database/schemas/project/project.service";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import Sale, {SalePaymentType} from "../../../database/schemas/sale/sale";
import Unit, {UnitStatus} from "../../../database/schemas/unit/unit";
import Edifice from "../../../database/schemas/edifice/edifice";
import Floor from "../../../database/schemas/floor/floor";
import {InstallmentStatus, PaymentPlanStatus,} from "../../../database/schemas/paymentPlan/paymentPlan";
import type {
    PaymentAlertItem
} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.response.type";
import {
    DashboardFormResponseType,
    DashboardSummary,
    PeriodDatum,
    RecentSaleItem,
    RevenueByCurrency,
    SalesByPaymentType,
    UnitsByStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.response.type";
import {DashboardFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.type";
import {
    dashboardFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.validator";
import {COLLECTED_DATA} from "@coreModule/database/collections";
import DashboardCache from "../../../database/schemas/dashboardCache/dashboardCache";
import {unitCostService} from "../../../database/schemas/unitCost/unitCost.service";
import UnitCost from "../../../database/schemas/unitCost/unitCost";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {
    resolveHierarchySetsFromUnitIds,
    buildUnitCostRollupMatch,
    type UnitCostHierarchyIdSets,
} from "../../../database/schemas/unitCost/unitCostHierarchy.util";

const router = Router();

/** SchemaGuard read shape for unit-cost money on the dashboard (aligns with unit statistics). */
const UNIT_COST_STATS_READ_SHAPE_DASH = {
    verificationStatus: {},
    paymentStatus: {},
    currency: CurrencySimpleSnippet,
    expenditureItems: {},
} as const;

function unitCostDocSubtotalStage() {
    return {
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
}

function unitCostMoneyByCurrencyPipeline(
    companyId: ObjectId,
    unitIds: ObjectId[],
    sets: UnitCostHierarchyIdSets,
    extraMatch: Record<string, unknown>
): Record<string, unknown>[] {
    return [
        {
            $match: buildUnitCostRollupMatch(companyId, unitIds, sets, extraMatch),
        },
        unitCostDocSubtotalStage(),
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
                _id: "$currency",
                total: {$sum: "$docSubtotal"},
                currencyInfo: {$first: "$currencyInfo"},
            },
        },
    ];
}

function toNumber(v: any): number {
    if (v == null) return 0;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "object" && typeof v.toString === "function")
        return parseFloat(v.toString()) || 0;
    return parseFloat(String(v)) || 0;
}

function mapUnitCostCurrencyAgg(rows: unknown[]): RevenueByCurrency[] {
    return (rows as any[]).map((r: any) => ({
        currencyId: r._id?.toString() ?? "",
        currencyName: r.currencyInfo?.name,
        currencySymbol: r.currencyInfo?.symbol,
        value: toNumber(r.total),
    }));
}

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildDashboardCacheKey(companyId: string, params: {projectId?: string; edificeId?: string; period?: string; from?: string; to?: string; recentSalesLimit?: number}): string {
    return `dashboard:${companyId}:${params.projectId ?? ""}:${params.edificeId ?? ""}:${params.period ?? "month"}:${params.from ?? ""}:${params.to ?? ""}:${params.recentSalesLimit ?? 10}`;
}

/**
 * POST /api/realEstate/dashboard
 *
 * Returns dashboard statistics for the current company (summary, charts, recent sales).
 *
 * @route POST /api/realEstate/dashboard
 * @access Private
 * @body {DashboardFormType} - optional from, to, period, recentSalesLimit, projectId, edificeId
 * @returns {Promise<DashboardFormResponseType>}
 */
router.post(
    "",
    authMW("private"),
    rateLimiter({ windowMs: 60000, max: 60 }),
    validateFormZod(dashboardFormSchema),
    asyncHandler(getDashboardStats)
);

async function getDashboardStats(
    params: AuthenticatedMWType & DashboardFormType
): Promise<DashboardFormResponseType> {
    const {
        logger,
        languageCode,
        actionUserCtx,
        company,
        from,
        to,
        period = "month",
        recentSalesLimit = 10,
        projectId,
        edificeId,
    } = params;

    logger.start("Fetching dashboard stats...");
    const opts = { logger, languageCode };

    // Cache check — return pre-computed result if still fresh (< 5 min old)
    const cacheKey = buildDashboardCacheKey(company._id.toString(), {projectId, edificeId, period, from, to, recentSalesLimit});
    try {
        const cached = await DashboardCache.findOne({cacheKey}).lean();
        if (cached && cached.computedAt && Date.now() - new Date(cached.computedAt).getTime() < DASHBOARD_CACHE_TTL_MS) {
            logger.finish("Dashboard stats served from cache.");
            const cachedResult = cached.result as any;
            return {
                ...cachedResult,
                summary: sanitizeDashboardSummary(cachedResult.rawSummary, actionUserCtx, languageCode),
            };
        }
    } catch {
        // Cache read failure is non-fatal — fall through to compute
    }

    // Build unit filter using denormalized project/edifice fields (avoids 3-hop fan-out)
    const unitFilter: Record<string, unknown> = {company: company._id};
    if (projectId && ObjectId.isValid(projectId)) unitFilter.project = new ObjectId(projectId);
    else if (edificeId && ObjectId.isValid(edificeId)) unitFilter.edifice = new ObjectId(edificeId);

    const companyUnits = await unitService.find(
        unitFilter,
        opts,
        null,
        "_id",
        {},
        undefined,
        undefined
    );
    const companyUnitIds = companyUnits
        .map((u) => u._id)
        .filter((id): id is ObjectId => id != null);

    if (companyUnitIds.length === 0) {
        const [projectsCount0, edificesCount0, floorsCount0] = await Promise.all([
            projectService.count({ company: company._id }, opts),
            edificeService.count(
                projectId && ObjectId.isValid(projectId)
                    ? { project: new ObjectId(projectId), company: company._id }
                    : { company: company._id },
                opts
            ),
            floorService.count(
                edificeId && ObjectId.isValid(edificeId)
                    ? { edifice: new ObjectId(edificeId), company: company._id }
                    : { company: company._id },
                opts
            ),
        ]);
        const emptySummary = buildEmptySummary();
        emptySummary.totalProjects = projectsCount0;
        emptySummary.totalEdifices = edificesCount0;
        emptySummary.totalFloors = floorsCount0;
        logger.finish("Dashboard stats (no units).");
        return {
            summary: sanitizeDashboardSummary(emptySummary, actionUserCtx, languageCode),
            revenueByPeriod: [],
            salesByPeriod: [],
            recentSales: [],
        };
    }

    const unitCostHierarchySets = await resolveHierarchySetsFromUnitIds(companyUnitIds, opts);

    const saleFilter: any = { unit: { $in: companyUnitIds } };
    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);
    if (Object.keys(dateFilter).length) saleFilter.saleDate = dateFilter;

    const periodMonths = period === "week" ? 3 : 12;
    const startPeriod = new Date();
    startPeriod.setMonth(startPeriod.getMonth() - periodMonths);
    const periodStart = from ? new Date(from) : startPeriod;
    const periodEnd = to ? new Date(to) : new Date();

    const saleIdsForPaymentPlans = await saleService.find(
        { unit: { $in: companyUnitIds } },
        opts,
        null,
        "_id",
        {},
        undefined,
        undefined
    );
    const saleIds = saleIdsForPaymentPlans.map((s) => s._id).filter((id): id is ObjectId => id != null);

    const now = new Date();
    const expiringEnd = new Date(now);
    expiringEnd.setDate(expiringEnd.getDate() + 7);

    const [
        totalSalesCount,
        revenueByCurrencyAgg,
        revenueByMonthAgg,
        salesByMonthAgg,
        recentSalesList,
        unitsByStatusAgg,
        projectsCount,
        edificesCount,
        floorsCount,
        activeReservationsCount,
        paymentPlansByStatusAgg,
        paymentPlansOutstandingAgg,
        overdueInstallmentsAgg,
        inspectionsByStatusAgg,
        inspectionsFollowUpCount,
        modificationRequestsByStatusAgg,
        salesByPaymentTypeAgg,
        inventoryValueAgg,
        expiringReservationsCount,
        totalReservationDepositsAgg,
        paymentAlertsListAgg,
        unitCostsVerifiedPaidAgg,
        unitCostsVerifiedOutstandingAgg,
        unitCostsPendingVerificationAgg,
        unitCostsDocumentCount,
    ] = await Promise.all([
        saleService.count(saleFilter, opts),
        saleService.aggregate(
            [
                { $match: { unit: { $in: companyUnitIds }, ...(Object.keys(dateFilter).length ? { saleDate: dateFilter } : {}) } },
                {
                    $group: {
                        _id: "$saleCurrency",
                        total: { $sum: "$finalPrice" },
                    },
                },
                {
                    $lookup: {
                        from: "currencies",
                        localField: "_id",
                        foreignField: "_id",
                        as: "currencyInfo",
                    },
                },
                { $unwind: { path: "$currencyInfo", preserveNullAndEmptyArrays: true } },
            ],
            opts
        ),
        saleService.aggregate(
            [
                {
                    $match: {
                        unit: { $in: companyUnitIds },
                        saleDate: { $gte: periodStart, $lte: periodEnd },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$saleDate" },
                            month: { $month: "$saleDate" },
                        },
                        totalRevenue: { $sum: "$finalPrice" },
                    },
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
            opts
        ),
        saleService.aggregate(
            [
                {
                    $match: {
                        unit: { $in: companyUnitIds },
                        saleDate: { $gte: periodStart, $lte: periodEnd },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$saleDate" },
                            month: { $month: "$saleDate" },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
            opts
        ),
        saleService.find(
            { unit: { $in: companyUnitIds } },
            opts,
            [
                { path: "unit", select: "name unitNumber" },
                { path: "soldBy", select: "name surname fullName" },
                { path: "saleCurrency", select: "name" },
            ],
            "unit soldBy saleCurrency saleDate finalPrice paymentType",
            { saleDate: -1 },
            Math.min(Math.max(1, recentSalesLimit), 50),
            0
        ),
        unitService.aggregate(
            [{ $match: { _id: { $in: companyUnitIds } } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
            opts
        ),
        projectService.count({ company: company._id }, opts),
        edificeService.count(
            projectId && ObjectId.isValid(projectId)
                ? { project: new ObjectId(projectId), company: company._id }
                : { company: company._id },
            opts
        ),
        floorService.count(
            edificeId && ObjectId.isValid(edificeId)
                ? { edifice: new ObjectId(edificeId), company: company._id }
                : { company: company._id },
            opts
        ),
        reservationService.count(
            { unit: { $in: companyUnitIds }, isActive: true },
            opts
        ),
        saleIds.length > 0
            ? paymentPlanService.aggregate(
                  [
                      { $match: { sale: { $in: saleIds } } },
                      { $group: { _id: "$status", count: { $sum: 1 } } },
                  ],
                  opts
              )
            : Promise.resolve([]),
        saleIds.length > 0
            ? paymentPlanService.aggregate(
                  [
                      { $match: { sale: { $in: saleIds }, status: PaymentPlanStatus.ACTIVE } },
                      { $group: { _id: null, total: { $sum: "$remainingBalance" } } },
                  ],
                  opts
              )
            : Promise.resolve([]),
        saleIds.length > 0
            ? paymentPlanService.aggregate(
                  [
                      { $match: { sale: { $in: saleIds } } },
                      { $unwind: "$installments" },
                      {
                          $match: {
                              $or: [
                                  { "installments.status": InstallmentStatus.OVERDUE },
                                  {
                                      "installments.dueDate": { $lt: new Date() },
                                      "installments.status": { $nin: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
                                  },
                              ],
                          },
                      },
                      { $count: "count" },
                  ],
                  opts
              )
            : Promise.resolve([]),
        inspectionService.aggregate(
            [
                { $match: { unit: { $in: companyUnitIds } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            opts
        ),
        inspectionService.count(
            { unit: { $in: companyUnitIds }, followUpRequired: true },
            opts
        ),
        modificationRequestService.aggregate(
            [
                { $match: { unit: { $in: companyUnitIds } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            opts
        ),
        saleService.aggregate(
            [
                { $match: saleFilter },
                { $group: { _id: "$paymentType", count: { $sum: 1 } } },
            ],
            opts
        ),
        unitService.aggregate(
            [
                {
                    $match: {
                        _id: { $in: companyUnitIds },
                        status: { $in: [UnitStatus.AVAILABLE, UnitStatus.RESERVED] },
                    },
                },
                { $group: { _id: null, total: { $sum: "$price" } } },
            ],
            opts
        ),
        reservationService.count(
            {
                unit: { $in: companyUnitIds },
                isActive: true,
                expirationDate: { $exists: true, $gte: now, $lte: expiringEnd },
            },
            opts
        ),
        reservationService.aggregate(
            [
                {
                    $match: {
                        unit: { $in: companyUnitIds },
                        isActive: true,
                        depositAmount: { $exists: true, $ne: null },
                    },
                },
                { $group: { _id: null, total: { $sum: "$depositAmount" } } },
            ],
            opts
        ),
        saleIds.length > 0
            ? paymentPlanService.aggregate(
                  [
                      { $match: { sale: { $in: saleIds } } },
                      { $unwind: "$installments" },
                      {
                          $match: {
                              "installments.status": { $nin: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
                              "installments.dueDate": { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                          },
                      },
                      { $lookup: { from: "sales", localField: "sale", foreignField: "_id", as: "saleDoc" } },
                      { $unwind: "$saleDoc" },
                      { $lookup: { from: "units", localField: "saleDoc.unit", foreignField: "_id", as: "unitDoc" } },
                      { $unwind: "$unitDoc" },
                      {
                          $project: {
                              unitId: "$unitDoc._id",
                              unitNumber: "$unitDoc.unitNumber",
                              unitName: "$unitDoc.name",
                              amount: "$installments.amount",
                              dueDate: "$installments.dueDate",
                          },
                      },
                      { $limit: 50 },
                  ],
                  opts
              )
            : Promise.resolve([]),
        unitCostService.aggregate(
            unitCostMoneyByCurrencyPipeline(company._id, companyUnitIds, unitCostHierarchySets, {
                verificationStatus: "verified",
                paymentStatus: "paid",
            }),
            opts
        ),
        unitCostService.aggregate(
            unitCostMoneyByCurrencyPipeline(company._id, companyUnitIds, unitCostHierarchySets, {
                verificationStatus: "verified",
                paymentStatus: {$in: ["unpaid", "partially_paid", "disputed"]},
            }),
            opts
        ),
        unitCostService.aggregate(
            unitCostMoneyByCurrencyPipeline(company._id, companyUnitIds, unitCostHierarchySets, {
                verificationStatus: {$in: ["pending_verification", "needs_revision"]},
            }),
            opts
        ),
        unitCostService.count(
            buildUnitCostRollupMatch(company._id, companyUnitIds, unitCostHierarchySets, {}),
            opts
        ),
    ]);

    const totalRevenueByCurrency: RevenueByCurrency[] = revenueByCurrencyAgg.map((r: any) => ({
        currencyId: r._id?.toString() ?? "",
        currencyName: r.currencyInfo?.name,
        currencySymbol: r.currencyInfo?.symbol,
        value: toNumber(r.total),
    }));

    const revenueByPeriod: PeriodDatum[] = revenueByMonthAgg.map((r: any) => ({
        month: `${r._id?.year}-${String(r._id?.month ?? 0).padStart(2, "0")}`,
        totalRevenue: toNumber(r.totalRevenue),
    }));

    const salesByPeriod: PeriodDatum[] = salesByMonthAgg.map((r: any) => ({
        month: `${r._id?.year}-${String(r._id?.month ?? 0).padStart(2, "0")}`,
        count: r.count ?? 0,
    }));

    const unitsByStatus: UnitsByStatus = {
        available: 0,
        unavailable: 0,
        reserved: 0,
        sold: 0,
    };
    for (const row of unitsByStatusAgg) {
        const status = row._id as string;
        const count = row.count ?? 0;
        if (status === UnitStatus.AVAILABLE) unitsByStatus.available = count;
        else if (status === UnitStatus.UNAVAILABLE) unitsByStatus.unavailable = count;
        else if (status === UnitStatus.RESERVED) unitsByStatus.reserved = count;
        else if (status === UnitStatus.SOLD) unitsByStatus.sold = count;
    }

    const paymentPlansByStatus = {
        active: 0,
        completed: 0,
        defaulted: 0,
        cancelled: 0,
    };
    for (const row of paymentPlansByStatusAgg) {
        const status = row._id as string;
        const count = row.count ?? 0;
        if (status === PaymentPlanStatus.ACTIVE) paymentPlansByStatus.active = count;
        else if (status === PaymentPlanStatus.COMPLETED) paymentPlansByStatus.completed = count;
        else if (status === PaymentPlanStatus.DEFAULTED) paymentPlansByStatus.defaulted = count;
        else if (status === PaymentPlanStatus.CANCELLED) paymentPlansByStatus.cancelled = count;
    }

    const totalOutstanding =
        paymentPlansOutstandingAgg.length > 0 && paymentPlansOutstandingAgg[0].total != null
            ? toNumber(paymentPlansOutstandingAgg[0].total)
            : 0;
    const overdueInstallmentsCount =
        overdueInstallmentsAgg.length > 0 && overdueInstallmentsAgg[0].count != null
            ? overdueInstallmentsAgg[0].count
            : 0;

    const inspectionsByStatus: Record<string, number> = {};
    for (const row of inspectionsByStatusAgg) {
        inspectionsByStatus[row._id as string] = row.count ?? 0;
    }
    const modificationRequestsByStatus: Record<string, number> = {};
    for (const row of modificationRequestsByStatusAgg) {
        modificationRequestsByStatus[row._id as string] = row.count ?? 0;
    }

    const salesByPaymentType: SalesByPaymentType = { cash: 0, payment_plan: 0 };
    for (const row of salesByPaymentTypeAgg) {
        const typ = row._id as string;
        const count = row.count ?? 0;
        if (typ === SalePaymentType.CASH) salesByPaymentType.cash = count;
        else if (typ === SalePaymentType.PAYMENT_PLAN) salesByPaymentType.payment_plan = count;
    }

    const inventoryValue =
        inventoryValueAgg.length > 0 && inventoryValueAgg[0].total != null
            ? toNumber(inventoryValueAgg[0].total)
            : 0;

    const totalReservationDeposits =
        totalReservationDepositsAgg.length > 0 && totalReservationDepositsAgg[0].total != null
            ? toNumber(totalReservationDepositsAgg[0].total)
            : 0;

    const verifiedPaidUnitCosts = mapUnitCostCurrencyAgg(unitCostsVerifiedPaidAgg);
    const verifiedOutstandingUnitCosts = mapUnitCostCurrencyAgg(unitCostsVerifiedOutstandingAgg);
    const pendingVerificationUnitCosts = mapUnitCostCurrencyAgg(unitCostsPendingVerificationAgg);
    const totalUnitCostDocuments = typeof unitCostsDocumentCount === "number" ? unitCostsDocumentCount : 0;

    const totalRevenueSum = totalRevenueByCurrency.reduce((acc, r) => acc + r.value, 0);
    const averageSalePrice = totalSalesCount > 0 ? totalRevenueSum / totalSalesCount : 0;
    const totalUnitsCount = companyUnitIds.length;
    const occupancyRatePercent = totalUnitsCount > 0 ? (unitsByStatus.sold / totalUnitsCount) * 100 : 0;
    const totalInspections = Object.values(inspectionsByStatus).reduce((a, b) => a + b, 0);
    const TERMINAL_MODIFICATION_STATUSES = ["completed", "rejected", "cancelled"];
    const openModificationRequests = Object.entries(modificationRequestsByStatus).reduce(
        (sum, [status, count]) => (TERMINAL_MODIFICATION_STATUSES.includes(status) ? sum : sum + count),
        0
    );

    const summary: DashboardSummary = {
        totalRevenue: totalRevenueByCurrency,
        totalSales: totalSalesCount,
        totalUnits: companyUnitIds.length,
        totalProjects: projectsCount,
        totalEdifices: edificesCount,
        totalFloors: floorsCount,
        unitsByStatus,
        activeReservations: activeReservationsCount,
        paymentPlans: {
            byStatus: paymentPlansByStatus,
            totalOutstanding,
            overdueInstallmentsCount,
        },
        inspections: {
            byStatus: inspectionsByStatus,
            followUpRequiredCount: inspectionsFollowUpCount,
        },
        modificationRequests: {
            byStatus: modificationRequestsByStatus,
        },
        averageSalePrice,
        inventoryValue,
        salesByPaymentType,
        occupancyRatePercent,
        totalInspections,
        openModificationRequests,
        expiringReservationsCount,
        totalReservationDeposits,
        paymentPlansCompleted: paymentPlansByStatus.completed,
        paymentPlansDefaulted: paymentPlansByStatus.defaulted,
        verifiedPaidUnitCosts,
        verifiedOutstandingUnitCosts,
        pendingVerificationUnitCosts,
        totalUnitCostDocuments,
    };

    const recentSales: RecentSaleItem[] = recentSalesList.map((s: any) => ({
        _id: s._id.toString(),
        unit: s.unit
            ? {
                  _id: s.unit._id?.toString() ?? "",
                  name: s.unit.name,
                  unitNumber: s.unit.unitNumber,
              }
            : { _id: "", name: undefined, unitNumber: undefined },
        finalPrice: toNumber(s.finalPrice),
        saleDate: s.saleDate ? new Date(s.saleDate).toISOString() : "",
        soldBy: s.soldBy
            ? {
                  _id: s.soldBy._id?.toString() ?? "",
                  name: s.soldBy.name,
                  surname: s.soldBy.surname,
                  fullName: s.soldBy.fullName,
              }
            : { _id: "", name: undefined, surname: undefined, fullName: undefined },
        paymentType: s.paymentType ?? "",
        saleCurrency: s.saleCurrency
            ? { _id: s.saleCurrency._id?.toString() ?? "", name: s.saleCurrency.name }
            : { _id: "", name: undefined },
    }));

    const nowMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const paymentAlerts: PaymentAlertItem[] = (paymentAlertsListAgg || []).map((row: any) => {
        const dueDate = row.dueDate ? new Date(row.dueDate) : new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - nowMs) / oneDayMs);
        return {
            unit: {
                _id: row.unitId?.toString?.() ?? "",
                unitNumber: row.unitNumber,
                name: row.unitName,
            },
            installment: {
                amount: toNumber(row.amount),
                dueDate: dueDate.toISOString(),
            },
            daysUntilDue,
        };
    });

    const sanitizedSummary = sanitizeDashboardSummary(summary, actionUserCtx, languageCode);

    // Write to cache (fire-and-forget — don't block the response)
    DashboardCache.findOneAndUpdate(
        {cacheKey},
        {$set: {company: company._id, result: {rawSummary: summary, revenueByPeriod, salesByPeriod, recentSales, paymentAlerts}, computedAt: new Date()}},
        {upsert: true, new: true},
    ).catch(() => { /* cache write failure is non-fatal */ });

    logger.finish("Dashboard stats done.");

    return {
        summary: sanitizedSummary,
        revenueByPeriod,
        salesByPeriod,
        recentSales,
        paymentAlerts,
    };
}

function buildEmptySummary(): DashboardSummary {
    return {
        totalRevenue: [],
        totalSales: 0,
        totalUnits: 0,
        totalProjects: 0,
        totalEdifices: 0,
        totalFloors: 0,
        unitsByStatus: { available: 0, unavailable: 0, reserved: 0, sold: 0 },
        activeReservations: 0,
        paymentPlans: {
            byStatus: { active: 0, completed: 0, defaulted: 0, cancelled: 0 },
            totalOutstanding: 0,
            overdueInstallmentsCount: 0,
        },
        inspections: { byStatus: {}, followUpRequiredCount: 0 },
        modificationRequests: { byStatus: {} },
        averageSalePrice: 0,
        inventoryValue: 0,
        salesByPaymentType: { cash: 0, payment_plan: 0 },
        occupancyRatePercent: 0,
        totalInspections: 0,
        openModificationRequests: 0,
        expiringReservationsCount: 0,
        totalReservationDeposits: 0,
        paymentPlansCompleted: 0,
        paymentPlansDefaulted: 0,
        verifiedPaidUnitCosts: [],
        verifiedOutstandingUnitCosts: [],
        pendingVerificationUnitCosts: [],
        totalUnitCostDocuments: 0,
    };
}

function sanitizeDashboardSummary(
    summary: DashboardSummary,
    actionUserCtx: any,
    languageCode: string
): DashboardSummary {
    const out = { ...summary };

    try {
        SchemaGuard.sanitizeFields(Sale, COLLECTED_DATA["sales"].readFields, "read", actionUserCtx, languageCode);
    } catch {
        out.totalRevenue = [];
        out.totalSales = 0;
        out.averageSalePrice = 0;
        out.salesByPaymentType = { cash: 0, payment_plan: 0 };
    }

    try {
        SchemaGuard.sanitizeFields(Unit, COLLECTED_DATA["units"].readFields, "read", actionUserCtx, languageCode);
    } catch {
        out.unitsByStatus = { available: 0, unavailable: 0, reserved: 0, sold: 0 };
        out.totalUnits = 0;
        out.inventoryValue = 0;
        out.occupancyRatePercent = 0;
    }

    try {
        SchemaGuard.sanitizeFields(Edifice, { name: {} }, "read", actionUserCtx, languageCode);
    } catch {
        out.totalEdifices = 0;
    }

    try {
        SchemaGuard.sanitizeFields(Floor, COLLECTED_DATA["floors"].readFields, "read", actionUserCtx, languageCode);
    } catch {
        out.totalFloors = 0;
    }

    try {
        SchemaGuard.sanitizeFields(UnitCost, UNIT_COST_STATS_READ_SHAPE_DASH as any, "read", actionUserCtx, languageCode);
    } catch {
        out.verifiedPaidUnitCosts = [];
        out.verifiedOutstandingUnitCosts = [];
        out.pendingVerificationUnitCosts = [];
        out.totalUnitCostDocuments = 0;
    }

    return out;
}

export const basePath = "/api/realEstate/dashboard";
export { router };
