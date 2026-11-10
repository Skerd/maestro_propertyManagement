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

import {addLocalDays, localDateOf} from "@coreModule/utilities/time/timeWindows";
import {calendarDaysUntil} from "../../../utilities/reservation/reservationExpirationCalendar";
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
import {ReservationStatus} from "../../../database/schemas/reservation/reservation";
import {saleService} from "../../../database/schemas/sale/sale.service";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {projectService} from "../../../database/schemas/project/project.service";
import {SalePaymentType} from "../../../database/schemas/sale/sale";
import {UnitStatus} from "../../../database/schemas/unit/unit";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
} from "@propertyManagement/utilities/security/canReadCollectedFields";
import type {UserContext} from "@coreModule/utilities/types/types";
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
import {dashboardCacheService} from "../../../database/schemas/dashboardCache/dashboardCache.service";
import {unitCostService} from "../../../database/schemas/unitCost/unitCost.service";
import {rentalPaymentService} from "../../../database/schemas/rentalPayment/rentalPayment.service";
import {RentalPaymentStatus} from "../../../database/schemas/rentalPayment/rentalPayment";
import {leaseService} from "../../../database/schemas/lease/lease.service";
import {LeaseStatus} from "../../../database/schemas/lease/lease";
import {
    moneyNumber,
    moneyToScaled,
    remainingNumber,
    remainingScaled,
    scaledToDecimal128,
    type RentMoneyRow,
} from "../../../utilities/lease/rentRemaining";
import {
    resolveHierarchySetsFromUnitIds,
    buildUnitCostRollupMatch,
    type UnitCostHierarchyIdSets,
} from "../../../database/schemas/unitCost/unitCostHierarchy.util";
import {UNIT_COST_DOC_SUBTOTAL_STAGE} from "../../../database/schemas/unitCost/unitCostInheritedPipelines.util";
import {DEFAULT_DECIMAL_PLACES, type MoneyInput, minorToNumber, prorateMinor, subtractMoney, toMinor} from "armonia/src/modules/core/helpers/money";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    addMoney,
    addMoneyLines,
    aggregateCurrencyFields,
    type AggregateMoneyLine,
    currencyOfLine,
    type MoneyTotals,
    revenueRowsOf,
} from "../../../utilities/statistics/moneyTotals";
import {installmentPaidDay} from "../../../utilities/paymentsHub/paymentsHubMapper.dto";
import {type DayRange, inDayRange} from "../../../utilities/hubShared/dayRange";

const router = Router();

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
        UNIT_COST_DOC_SUBTOTAL_STAGE,
        {$group: {_id: "$currency", total: {$sum: "$docSubtotal"}}},
        ...CURRENCY_LINE_STAGES,
    ];
}

/**
 * After a `$group` on a currency id with a `$toDecimal` sum in `total`: the currency looked up and the group as an
 * {@link AggregateMoneyLine} (its `count` kept when the group has one).
 */
const CURRENCY_LINE_STAGES = [
    {$lookup: {from: "currencies", localField: "_id", foreignField: "_id", as: "currencyInfo"}},
    {$unwind: {path: "$currencyInfo", preserveNullAndEmptyArrays: true}},
    {$project: {_id: 0, currencyId: "$_id", ...aggregateCurrencyFields("currencyInfo"), value: "$total", count: 1}},
];

/** Aggregate money lines as exact dashboard rows, one per currency (GLB-08, TD-B166). */
function revenueRows(lines: AggregateMoneyLine[]): RevenueByCurrency[] {
    const totals: MoneyTotals = new Map();
    addMoneyLines(totals, lines);
    return revenueRowsOf(totals);
}

/** A single stored amount (an alert's installment, a recent sale's price) as a number for the wire. */
function toNumber(v: any): number {
    if (v == null) return 0;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "object" && typeof v.toString === "function")
        return parseFloat(v.toString()) || 0;
    return parseFloat(String(v)) || 0;
}

function emptyRentalsSummary() {
    return {
        collectedAmount: [] as RevenueByCurrency[],
        outstandingAmount: [] as RevenueByCurrency[],
        overdueAmount: [] as RevenueByCurrency[],
        overdueCount: 0,
        activeLeases: 0,
    };
}

function dashboardReadAccess(actionUserCtx: UserContext, languageCode: string) {
    const sales = canReadCollectedFields("sales", actionUserCtx, languageCode);
    const units = canReadCollectedFields("units", actionUserCtx, languageCode);
    const projects = canReadCollectedFields("projects", actionUserCtx, languageCode);
    const edifices = canReadCollectedFields("edifices", actionUserCtx, languageCode);
    const floors = canReadCollectedFields("floors", actionUserCtx, languageCode);
    const reservations = canReadCollectedFields("reservations", actionUserCtx, languageCode);
    const paymentPlans = canReadCollectedFields("paymentplans", actionUserCtx, languageCode);
    const inspections = canReadCollectedFields("inspections", actionUserCtx, languageCode);
    const modificationRequests = canReadCollectedFields("modificationrequests", actionUserCtx, languageCode);
    const unitCosts = canReadCollectedFields("unitcosts", actionUserCtx, languageCode);
    const rentalPayments = canReadCollectedFields("rentalpayments", actionUserCtx, languageCode);
    const leases = canReadCollectedFields("leases", actionUserCtx, languageCode);
    return {
        sales,
        units,
        projects,
        edifices,
        floors,
        reservations,
        paymentPlans,
        inspections,
        modificationRequests,
        unitCosts,
        rentalPayments,
        leases,
        any: sales || units || projects || edifices || floors || reservations
            || paymentPlans || inspections || modificationRequests || unitCosts
            || rentalPayments || leases,
        all: sales && units && projects && edifices && floors && reservations
            && paymentPlans && inspections && modificationRequests && unitCosts
            && rentalPayments && leases,
        needsUnitScope: sales || units || reservations || paymentPlans || inspections
            || modificationRequests || unitCosts || rentalPayments || leases,
    };
}

/** One currency's rent total while it is summed, exactly (scaled). */
type RentBucket = {currencyId: string; currencyName?: string; currencySymbol?: string; currencyDecimalPlaces?: number; scaled: bigint};

function rentalsFromPayments(
    payments: (RentMoneyRow & {currency?: unknown})[],
    activeLeases: number,
) {
    const collected = new Map<string, RentBucket>();
    const outstanding = new Map<string, RentBucket>();
    const overdue = new Map<string, RentBucket>();
    let overdueCount = 0;

    const add = (
        map: Map<string, RentBucket>,
        payment: {currency?: unknown},
        scaled: bigint,
    ) => {
        const currency = payment.currency as {_id?: unknown; name?: string; symbol?: string; decimalPlaces?: number} | undefined;
        const currencyId = currency?._id != null ? String(currency._id) : "_none";
        const prev = map.get(currencyId) ?? {
            currencyId,
            currencyName: currency?.name,
            currencySymbol: currency?.symbol,
            currencyDecimalPlaces: currency?.decimalPlaces,
            scaled: 0n,
        };
        prev.scaled += scaled;
        map.set(currencyId, prev);
    };

    const toList = (map: Map<string, RentBucket>): RevenueByCurrency[] =>
        [...map.values()]
            .filter((row) => row.scaled !== 0n)
            .map((row) => ({
                currencyId: row.currencyId,
                currencyName: row.currencyName,
                currencySymbol: row.currencySymbol,
                ...(row.currencyDecimalPlaces != null ? {currencyDecimalPlaces: row.currencyDecimalPlaces} : {}),
                value: moneyNumber(scaledToDecimal128(row.scaled)),
            }));

    for (const payment of payments) {
        add(collected, payment, moneyToScaled(payment.paidAmount));
        if (payment.status === RentalPaymentStatus.WAIVED) continue;
        const rem = remainingScaled(payment);
        add(outstanding, payment, rem);
        if (payment.status === RentalPaymentStatus.OVERDUE && rem > 0n) {
            add(overdue, payment, rem);
            overdueCount += 1;
        }
    }

    return {
        collectedAmount: toList(collected),
        outstandingAmount: toList(outstanding),
        overdueAmount: toList(overdue),
        overdueCount,
        activeLeases,
    };
}

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildDashboardCacheKey(companyId: string, params: {projectId?: string; edificeId?: string; period?: string; from?: string; to?: string; recentSalesLimit?: number}): string {
    // v3: the summary has `collected` (TD-B176); an older entry lacks it and is never read back.
    return `dashboard:v3:${companyId}:${params.projectId ?? ""}:${params.edificeId ?? ""}:${params.period ?? "month"}:${params.from ?? ""}:${params.to ?? ""}:${params.recentSalesLimit ?? 10}`;
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

type DashboardParams = AuthenticatedMWType & DashboardFormType;
type DashboardAccess = ReturnType<typeof dashboardReadAccess>;
type DashboardOpts = {logger: DashboardParams["logger"]; languageCode: string; withDeleted: false};

/** What every statistics block reads: the caller's access, the units in scope and the company's days (D115). */
type DashboardScope = {
    params: DashboardParams;
    opts: DashboardOpts;
    access: DashboardAccess;
    unitIds: ObjectId[];
    today: string;
    /** The sale-day bounds the caller asked for (`from` / `to`), empty when none. */
    saleDays: {$gte?: string; $lte?: string};
    periodStart: string;
    periodEnd: string;
    expiringEnd: string;
    alertHorizon: string;
};

/** Rows an alert is built from: an installment or a reservation deposit coming due, with its currency's fields. */
type AlertSourceRow = Omit<AggregateMoneyLine, "value"> & {
    _id?: unknown;
    saleId?: unknown;
    reservationId?: unknown;
    unitId?: unknown;
    unitNumber?: string;
    unitName?: string;
    amount?: MoneyInput;
    /** An installment's payments so far; the alert shows what is left. */
    paidAmount?: MoneyInput;
    dueDate?: string;
    clientId?: unknown;
    clientName?: string;
    clientSurname?: string;
};

const NONE: never[] = [];

/** Projects, edifices and floors in the company (edifices of the project, floors of the edifice when filtered). */
async function hierarchyCounts({params, access, opts}: Pick<DashboardScope, "params" | "access" | "opts">) {
    const {company, projectId, edificeId} = params;
    const [projects, edifices, floors] = await Promise.all([
        access.projects ? projectService.count({ company: company._id }, opts) : Promise.resolve(0),
        access.edifices
            ? edificeService.count(
                projectId && ObjectId.isValid(projectId)
                    ? { project: new ObjectId(projectId), company: company._id }
                    : { company: company._id },
                opts
            )
            : Promise.resolve(0),
        access.floors
            ? floorService.count(
                edificeId && ObjectId.isValid(edificeId)
                    ? { edifice: new ObjectId(edificeId), company: company._id }
                    : { company: company._id },
                opts
            )
            : Promise.resolve(0),
    ]);
    return {projects, edifices, floors};
}

/** The average sale price in each currency: that currency's revenue over its number of sales, rounded once. */
function averageSalePriceOf(lines: (AggregateMoneyLine & {count?: number})[]): RevenueByCurrency[] {
    return lines.flatMap((line) => {
        const currency = currencyOfLine(line);
        if (!currency || !line.count) return [];
        const decimals = currency.decimalPlaces ?? DEFAULT_DECIMAL_PLACES;
        const average = prorateMinor(toMinor(String(line.value ?? 0), decimals), [1], line.count);
        return [{currencyId: currency._id, currencyName: currency.name, currencySymbol: currency.symbol, currencyDecimalPlaces: decimals, value: minorToNumber(average, decimals)}];
    });
}

/** Revenue per month (rows sorted by month), each month's revenue per currency. */
function revenueByPeriodOf(lines: (AggregateMoneyLine & {month?: string})[]): PeriodDatum[] {
    const byMonth = new Map<string, AggregateMoneyLine[]>();
    for (const line of lines) {
        const month = String(line.month ?? "");
        byMonth.set(month, [...(byMonth.get(month) ?? []), line]);
    }
    return [...byMonth.entries()].map(([month, monthLines]) => ({month, revenue: revenueRows(monthLines)}));
}

/** Sales: count, revenue per currency, revenue and count per month, the latest sales, cash vs. plan. */
async function salesStats({params, access, opts, unitIds, saleDays, periodStart, periodEnd}: DashboardScope) {
    if (!access.sales) {
        return {
            totalSales: 0,
            totalRevenue: [] as RevenueByCurrency[],
            averageSalePrice: [] as RevenueByCurrency[],
            revenueByPeriod: [] as PeriodDatum[],
            salesByPeriod: [] as PeriodDatum[],
            recentSales: [] as RecentSaleItem[],
            salesByPaymentType: { cash: 0, payment_plan: 0 } as SalesByPaymentType,
        };
    }
    const saleFilter: Record<string, unknown> = { unit: { $in: unitIds } };
    if (Object.keys(saleDays).length) saleFilter.saleDate = saleDays;
    const recentSalesLimit = params.recentSalesLimit ?? 10;

    const [totalSales, revenueByCurrencyAgg, revenueByMonthAgg, salesByMonthAgg, recentSalesList, salesByPaymentTypeAgg] = await Promise.all([
        saleService.count(saleFilter, opts),
        saleService.aggregate(
            [
                { $match: { unit: { $in: unitIds }, ...(Object.keys(saleDays).length ? { saleDate: saleDays } : {}) } },
                { $group: { _id: "$saleCurrency", total: { $sum: { $toDecimal: { $ifNull: ["$finalPrice", 0] } } }, count: { $sum: 1 } } },
                ...CURRENCY_LINE_STAGES,
            ],
            opts
        ),
        saleService.aggregate(
            [
                {
                    $match: {
                        unit: { $in: unitIds },
                        saleDate: { $gte: periodStart, $lte: periodEnd },
                    },
                },
                {
                    $group: {
                        // The month of a `YYYY-MM-DD` day is its first seven characters; each currency is its own sum.
                        _id: { month: { $substrBytes: ["$saleDate", 0, 7] }, currency: "$saleCurrency" },
                        total: { $sum: { $toDecimal: { $ifNull: ["$finalPrice", 0] } } },
                    },
                },
                { $lookup: { from: "currencies", localField: "_id.currency", foreignField: "_id", as: "currencyInfo" } },
                { $unwind: { path: "$currencyInfo", preserveNullAndEmptyArrays: true } },
                { $project: { _id: 0, month: "$_id.month", currencyId: "$_id.currency", ...aggregateCurrencyFields("currencyInfo"), value: "$total" } },
                { $sort: { month: 1 } },
            ],
            opts
        ),
        saleService.aggregate(
            [
                {
                    $match: {
                        unit: { $in: unitIds },
                        saleDate: { $gte: periodStart, $lte: periodEnd },
                    },
                },
                {
                    $group: {
                        _id: { $substrBytes: ["$saleDate", 0, 7] },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ],
            opts
        ),
        saleService.find(
            { unit: { $in: unitIds } },
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
        saleService.aggregate(
            [
                { $match: saleFilter },
                { $group: { _id: "$paymentType", count: { $sum: 1 } } },
            ],
            opts
        ),
    ]);

    const salesByPaymentType: SalesByPaymentType = { cash: 0, payment_plan: 0 };
    for (const row of salesByPaymentTypeAgg) {
        const typ = row._id as string;
        const count = row.count ?? 0;
        if (typ === SalePaymentType.CASH) salesByPaymentType.cash = count;
        else if (typ === SalePaymentType.PAYMENT_PLAN) salesByPaymentType.payment_plan = count;
    }

    return {
        totalSales,
        totalRevenue: revenueRows(revenueByCurrencyAgg),
        averageSalePrice: averageSalePriceOf(revenueByCurrencyAgg),
        revenueByPeriod: revenueByPeriodOf(revenueByMonthAgg),
        salesByPeriod: salesByMonthAgg.map((r: any): PeriodDatum => ({
            month: String(r._id ?? ""),
            count: r.count ?? 0,
        })),
        recentSales: recentSalesList.map((s: any): RecentSaleItem => ({
            _id: s._id.toString(),
            unit: s.unit
                ? {
                      _id: s.unit._id?.toString() ?? "",
                      name: s.unit.name,
                      unitNumber: s.unit.unitNumber,
                  }
                : { _id: "", name: undefined, unitNumber: undefined },
            finalPrice: toNumber(s.finalPrice),
            saleDate: s.saleDate ?? "",
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
        })),
        salesByPaymentType,
    };
}

/** Units per status, and the list value of the units still for sale (available or reserved). */
async function unitStats({access, opts, unitIds}: DashboardScope) {
    const [unitsByStatusAgg, inventoryValueAgg] = await Promise.all([
        access.units ? unitService.aggregate(
            [{ $match: { _id: { $in: unitIds } } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
            opts
        ) : Promise.resolve(NONE),
        access.units ? unitService.aggregate(
            [
                {
                    $match: {
                        _id: { $in: unitIds },
                        status: { $in: [UnitStatus.AVAILABLE, UnitStatus.RESERVED] },
                    },
                },
                { $group: { _id: "$priceCurrency", total: { $sum: { $toDecimal: { $ifNull: ["$price", 0] } } } } },
                ...CURRENCY_LINE_STAGES,
            ],
            opts
        ) : Promise.resolve(NONE),
    ]);

    const unitsByStatus: UnitsByStatus = {
        available: 0,
        unavailable: 0,
        reserved: 0,
        sold: 0,
        leased: 0,
    };
    for (const row of unitsByStatusAgg) {
        const status = row._id as string;
        const count = row.count ?? 0;
        if (status === UnitStatus.AVAILABLE) unitsByStatus.available = count;
        else if (status === UnitStatus.UNAVAILABLE) unitsByStatus.unavailable = count;
        else if (status === UnitStatus.RESERVED) unitsByStatus.reserved = count;
        else if (status === UnitStatus.SOLD) unitsByStatus.sold = count;
        else if (status === UnitStatus.RENTED) unitsByStatus.leased = count;
    }
    return {unitsByStatus, inventoryValue: revenueRows(inventoryValueAgg)};
}

/** Active reservations, those expiring within a week, their deposits, and unpaid deposits coming due. */
async function reservationStats({access, opts, unitIds, today, expiringEnd, alertHorizon}: DashboardScope) {
    if (!access.reservations) {
        return {activeReservations: 0, expiringReservationsCount: 0, totalReservationDeposits: [] as RevenueByCurrency[], alertRows: [] as AlertSourceRow[]};
    }
    const [activeReservations, expiringReservationsCount, totalReservationDepositsAgg, alertRows] = await Promise.all([
        reservationService.count(
            {unit: {$in: unitIds}, isActive: true, status: ReservationStatus.ACTIVE},
            opts
        ),
        reservationService.count(
            {
                unit: {$in: unitIds},
                isActive: true,
                status: ReservationStatus.ACTIVE,
                expirationDate: {$exists: true, $gte: today, $lte: expiringEnd},
            },
            opts
        ),
        reservationService.aggregate(
            [
                {
                    $match: {
                        unit: {$in: unitIds},
                        isActive: true,
                        status: ReservationStatus.ACTIVE,
                        deletedAt: null,
                        depositAmount: {$exists: true, $ne: null},
                    },
                },
                {$group: {_id: "$depositCurrency", total: {$sum: {$toDecimal: "$depositAmount"}}}},
                ...CURRENCY_LINE_STAGES,
            ],
            opts
        ),
        reservationService.aggregate(
            [
                {
                    $match: {
                        unit: {$in: unitIds},
                        isActive: true,
                        status: ReservationStatus.ACTIVE,
                        deletedAt: null,
                        paid: false,
                        expirationDate: {
                            $exists: true,
                            $ne: null,
                            $lte: alertHorizon,
                        },
                    },
                },
                {
                    $lookup: {
                        from: "units",
                        localField: "unit",
                        foreignField: "_id",
                        as: "unitDoc",
                    },
                },
                {$unwind: "$unitDoc"},
                { $lookup: { from: "users", localField: "client", foreignField: "_id", as: "clientDoc" } },
                { $unwind: { path: "$clientDoc", preserveNullAndEmptyArrays: true } },
                { $lookup: { from: "currencies", localField: "depositCurrency", foreignField: "_id", as: "currencyDoc" } },
                { $unwind: { path: "$currencyDoc", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        currencyId: "$depositCurrency",
                        ...aggregateCurrencyFields("currencyDoc"),
                        reservationId: "$_id",
                        unitId: "$unitDoc._id",
                        unitNumber: "$unitDoc.unitNumber",
                        unitName: "$unitDoc.name",
                        amount: {$ifNull: ["$depositAmount", 0]},
                        dueDate: "$expirationDate",
                        clientId: "$clientDoc._id",
                        clientName: "$clientDoc.name",
                        clientSurname: "$clientDoc.surname",
                    },
                },
                {$limit: 50},
            ],
            opts
        ),
    ]);
    return {activeReservations, expiringReservationsCount, totalReservationDeposits: revenueRows(totalReservationDepositsAgg), alertRows};
}

/** Payment plans per status, what active plans still owe, overdue installments, installments coming due. */
async function paymentPlanStats({access, opts, unitIds, today, alertHorizon}: DashboardScope) {
    const byStatus = {active: 0, completed: 0, defaulted: 0, cancelled: 0};
    const empty = {byStatus, totalOutstanding: [] as RevenueByCurrency[], overdueInstallmentsCount: 0, alertRows: [] as AlertSourceRow[]};
    if (!access.paymentPlans) return empty;

    const sales = await saleService.find({ unit: { $in: unitIds } }, opts, null, "_id", {}, undefined, undefined);
    const saleIds = sales.map((s) => s._id).filter((id): id is ObjectId => id != null);
    if (saleIds.length === 0) return empty;

    const [byStatusAgg, outstandingAgg, overdueAgg, alertRows] = await Promise.all([
        paymentPlanService.aggregate(
            [
                { $match: { sale: { $in: saleIds } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            opts
        ),
        paymentPlanService.aggregate(
            [
                { $match: { sale: { $in: saleIds }, status: PaymentPlanStatus.ACTIVE } },
                // A plan stores no currency: what it still owes is in its sale's currency.
                { $lookup: { from: "sales", localField: "sale", foreignField: "_id", pipeline: [{ $project: { saleCurrency: 1 } }], as: "saleDoc" } },
                { $unwind: "$saleDoc" },
                { $group: { _id: "$saleDoc.saleCurrency", total: { $sum: { $toDecimal: { $ifNull: ["$remainingBalance", 0] } } } } },
                ...CURRENCY_LINE_STAGES,
            ],
            opts
        ),
        paymentPlanService.aggregate(
            [
                { $match: { sale: { $in: saleIds } } },
                { $unwind: "$installments" },
                {
                    $match: {
                        $or: [
                            { "installments.status": InstallmentStatus.OVERDUE },
                            {
                                "installments.dueDate": { $lt: today },
                                "installments.status": { $nin: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
                            },
                        ],
                    },
                },
                { $count: "count" },
            ],
            opts
        ),
        paymentPlanService.aggregate(
            [
                { $match: { sale: { $in: saleIds } } },
                { $unwind: "$installments" },
                {
                    $match: {
                        "installments.status": { $nin: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
                        "installments.dueDate": { $lte: alertHorizon },
                    },
                },
                // A deleted sale's installments are not due; its unit is shown even when deleted (DB-04).
                { $lookup: { from: "sales", localField: "sale", foreignField: "_id", pipeline: [{ $match: { deletedAt: null } }], as: "saleDoc" } },
                { $unwind: "$saleDoc" },
                { $lookup: { from: "units", localField: "saleDoc.unit", foreignField: "_id", as: "unitDoc" } },
                { $unwind: "$unitDoc" },
                { $lookup: { from: "users", localField: "saleDoc.buyer", foreignField: "_id", as: "buyerDoc" } },
                { $unwind: { path: "$buyerDoc", preserveNullAndEmptyArrays: true } },
                // A plan stores no currency: its installments are in its sale's currency.
                { $lookup: { from: "currencies", localField: "saleDoc.saleCurrency", foreignField: "_id", as: "currencyDoc" } },
                { $unwind: { path: "$currencyDoc", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        currencyId: "$saleDoc.saleCurrency",
                        ...aggregateCurrencyFields("currencyDoc"),
                        saleId: "$saleDoc._id",
                        unitId: "$unitDoc._id",
                        unitNumber: "$unitDoc.unitNumber",
                        unitName: "$unitDoc.name",
                        amount: "$installments.amount",
                        paidAmount: "$installments.paidAmount",
                        dueDate: "$installments.dueDate",
                        clientId: "$buyerDoc._id",
                        clientName: "$buyerDoc.name",
                        clientSurname: "$buyerDoc.surname",
                    },
                },
                { $limit: 50 },
            ],
            opts
        ),
    ]);

    for (const row of byStatusAgg) {
        const status = row._id as string;
        const count = row.count ?? 0;
        if (status === PaymentPlanStatus.ACTIVE) byStatus.active = count;
        else if (status === PaymentPlanStatus.COMPLETED) byStatus.completed = count;
        else if (status === PaymentPlanStatus.DEFAULTED) byStatus.defaulted = count;
        else if (status === PaymentPlanStatus.CANCELLED) byStatus.cancelled = count;
    }
    return {
        byStatus,
        totalOutstanding: revenueRows(outstandingAgg),
        overdueInstallmentsCount: overdueAgg.length > 0 && overdueAgg[0].count != null ? overdueAgg[0].count : 0,
        alertRows,
    };
}

/** A payment-plan sale's plan with the sale's currency (a plan stores none): what was paid on it and when. */
type PlanPaymentsRow = AggregateMoneyLine & {
    plan: {
        downPayment?: MoneyInput;
        downPaymentPaid?: boolean;
        downPaymentDate?: string;
        installments?: {paidAmount?: MoneyInput; paidDate?: string; paymentReceipts?: {paidDate?: string}[]}[];
    };
};

/**
 * Money received in the period, per currency (TD-B176): cash sales on their sale day, payment-plan down payments and
 * installment payments on the day they were paid (an installment without a paid day: its last receipt's, as in the
 * payments hub), and the paid deposits of active reservations on their reservation day, since a reservation records
 * no payment day. Without a period, everything received so far. Rent has its own figure (`rentals.collectedAmount`).
 * It spans sales, plans and reservations, so it needs read access to all three; a partial sum is never shown.
 */
async function collectedStats({access, opts, unitIds, saleDays}: DashboardScope): Promise<RevenueByCurrency[]> {
    if (!access.sales || !access.paymentPlans || !access.reservations) return [];
    const days: DayRange = {from: saleDays.$gte, to: saleDays.$lte};
    const dayMatch = (field: string) => (Object.keys(saleDays).length ? {[field]: saleDays} : {});
    const [cashLines, planRows, depositLines] = await Promise.all([
        saleService.aggregate(
            [
                {$match: {unit: {$in: unitIds}, paymentType: SalePaymentType.CASH, ...dayMatch("saleDate")}},
                {$group: {_id: "$saleCurrency", total: {$sum: {$toDecimal: {$ifNull: ["$finalPrice", 0]}}}}},
                ...CURRENCY_LINE_STAGES,
            ],
            opts,
        ),
        saleService.aggregate(
            [
                {$match: {unit: {$in: unitIds}, paymentType: SalePaymentType.PAYMENT_PLAN, paymentPlan: {$exists: true, $ne: null}}},
                {
                    $lookup: {
                        from: "paymentplans",
                        localField: "paymentPlan",
                        foreignField: "_id",
                        // The soft-delete hook filters only the outer pipeline (DB-04).
                        pipeline: [
                            {$match: {deletedAt: null}},
                            {$project: {downPayment: 1, downPaymentPaid: 1, downPaymentDate: 1, "installments.paidAmount": 1, "installments.paidDate": 1, "installments.paymentReceipts.paidDate": 1}},
                        ],
                        as: "plan",
                    },
                },
                {$unwind: "$plan"},
                {$lookup: {from: "currencies", localField: "saleCurrency", foreignField: "_id", as: "currencyInfo"}},
                {$unwind: {path: "$currencyInfo", preserveNullAndEmptyArrays: true}},
                {$project: {_id: 0, plan: 1, currencyId: "$saleCurrency", ...aggregateCurrencyFields("currencyInfo")}},
            ],
            opts,
        ),
        reservationService.aggregate(
            [
                {$match: {unit: {$in: unitIds}, isActive: true, paid: true, deletedAt: null, depositAmount: {$exists: true, $ne: null}, ...dayMatch("reservationDate")}},
                {$group: {_id: "$depositCurrency", total: {$sum: {$toDecimal: "$depositAmount"}}}},
                ...CURRENCY_LINE_STAGES,
            ],
            opts,
        ),
    ]);

    const totals: MoneyTotals = new Map();
    addMoneyLines(totals, cashLines);
    addMoneyLines(totals, depositLines);
    addPlanPayments(totals, planRows, days);
    return revenueRowsOf(totals);
}

/** Adds each plan's down payment and installment payments made on a day in `days` to its sale currency's total. */
function addPlanPayments(totals: MoneyTotals, rows: PlanPaymentsRow[], days: DayRange): void {
    for (const {plan, ...line} of rows) {
        const currency = currencyOfLine(line);
        if (!currency) continue;
        if (plan.downPaymentPaid && inDayRange(plan.downPaymentDate, days)) addMoney(totals, currency, plan.downPayment);
        for (const installment of plan.installments ?? []) {
            if (installment.paidAmount != null && inDayRange(installmentPaidDay(installment), days)) addMoney(totals, currency, installment.paidAmount);
        }
    }
}

/** Inspections per status and those needing a follow-up. */
async function inspectionStats({access, opts, unitIds}: DashboardScope) {
    const [byStatusAgg, followUpRequiredCount] = await Promise.all([
        access.inspections ? inspectionService.aggregate(
            [
                { $match: { unit: { $in: unitIds } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            opts
        ) : Promise.resolve(NONE),
        access.inspections ? inspectionService.count(
            { unit: { $in: unitIds }, followUpRequired: true },
            opts
        ) : Promise.resolve(0),
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of byStatusAgg) {
        byStatus[row._id as string] = row.count ?? 0;
    }
    return {byStatus, followUpRequiredCount};
}

/** Modification requests per status. */
async function modificationRequestStats({access, opts, unitIds}: DashboardScope): Promise<Record<string, number>> {
    const byStatusAgg = access.modificationRequests ? await modificationRequestService.aggregate(
        [
            { $match: { unit: { $in: unitIds } } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ],
        opts
    ) : NONE;
    const byStatus: Record<string, number> = {};
    for (const row of byStatusAgg) {
        byStatus[row._id as string] = row.count ?? 0;
    }
    return byStatus;
}

/** Unit costs on the units in scope and on their floors, edifices and projects: paid, outstanding, pending, count. */
async function unitCostStats({params, access, opts, unitIds}: DashboardScope) {
    if (!access.unitCosts) {
        return {verifiedPaid: [] as RevenueByCurrency[], verifiedOutstanding: [] as RevenueByCurrency[], pending: [] as RevenueByCurrency[], documents: 0};
    }
    const companyId = params.company._id;
    const sets = await resolveHierarchySetsFromUnitIds(unitIds, opts);
    const [paidAgg, outstandingAgg, pendingAgg, documents] = await Promise.all([
        unitCostService.aggregate(
            unitCostMoneyByCurrencyPipeline(companyId, unitIds, sets, {
                verificationStatus: "verified",
                paymentStatus: "paid",
            }),
            opts
        ),
        unitCostService.aggregate(
            unitCostMoneyByCurrencyPipeline(companyId, unitIds, sets, {
                verificationStatus: "verified",
                paymentStatus: {$in: ["unpaid", "partially_paid", "disputed"]},
            }),
            opts
        ),
        unitCostService.aggregate(
            unitCostMoneyByCurrencyPipeline(companyId, unitIds, sets, {
                verificationStatus: {$in: ["pending_verification", "needs_revision"]},
            }),
            opts
        ),
        unitCostService.count(buildUnitCostRollupMatch(companyId, unitIds, sets, {}), opts),
    ]);
    return {
        verifiedPaid: revenueRows(paidAgg),
        verifiedOutstanding: revenueRows(outstandingAgg),
        pending: revenueRows(pendingAgg),
        documents: typeof documents === "number" ? documents : 0,
    };
}

/** Rent collected / outstanding / overdue, active leases, and unpaid rent coming due. */
async function rentalStats({access, opts, unitIds, today, alertHorizon}: DashboardScope) {
    const [rentalPayments, activeLeases] = await Promise.all([
        access.rentalPayments ? rentalPaymentService.find(
            {unit: {$in: unitIds}},
            {...opts, withDeleted: false},
            [
                {path: "currency", select: "name symbol abbreviation decimalPlaces"},
                {path: "unit", select: "name unitNumber"},
                {
                    path: "lease",
                    select: "tenant",
                    populate: {path: "tenant", select: "name surname"},
                },
            ],
            "amount paidAmount lateFeeAmount status currency unit dueDate lease",
        ) : Promise.resolve(NONE),
        access.leases ? leaseService.count(
            {unit: {$in: unitIds}, status: LeaseStatus.ACTIVE},
            opts,
        ) : Promise.resolve(0),
    ]);

    const rentAlerts: PaymentAlertItem[] = rentalPayments
        .filter((p) => {
            if (p.status === RentalPaymentStatus.WAIVED || p.status === RentalPaymentStatus.PAID) return false;
            if (remainingNumber(p) <= 0) return false;
            return !!p.dueDate && p.dueDate <= alertHorizon;
        })
        .map((p) => {
            const unit = p.unit as unknown as {_id?: unknown; unitNumber?: string; name?: string} | undefined;
            const lease = p.lease as unknown as {
                tenant?: {_id?: unknown; name?: string; surname?: string};
            } | undefined;
            const tenant = lease?.tenant;
            const currency = mapSnippet<CurrencySimple>()(p.currency as object | undefined, CurrencySimpleSnippet);
            const dueDate = p.dueDate || today;
            const client =
                tenant?._id != null
                    ? {
                          _id: String(tenant._id),
                          name: tenant.name,
                          surname: tenant.surname,
                      }
                    : undefined;
            return {
                kind: "rent" as const,
                unit: {
                    _id: unit?._id != null ? String(unit._id) : "",
                    unitNumber: unit?.unitNumber != null ? String(unit.unitNumber) : undefined,
                    name: unit?.name,
                },
                ...(client ? {client} : {}),
                installment: {
                    amount: remainingNumber(p),
                    dueDate,
                },
                ...(currency ? {currency} : {}),
                daysUntilDue: calendarDaysUntil(dueDate, today),
                rentalPaymentId: p._id != null ? String(p._id) : undefined,
            };
        });

    return {rentals: rentalsFromPayments(rentalPayments, typeof activeLeases === "number" ? activeLeases : 0), rentAlerts};
}

/** What is left on an installment: its amount less what was paid on it, at its currency's decimals (GLB-08). */
function installmentLeft(row: AlertSourceRow): number {
    return subtractMoney(row.amount, row.paidAmount, currencyOfLine(row)?.decimalPlaces ?? DEFAULT_DECIMAL_PLACES);
}

/** An installment or reservation alert from its source row. */
function alertOf(row: AlertSourceRow, kind: "installment" | "reservation", today: string): PaymentAlertItem {
    const dueDate: string = row.dueDate || today;
    const client: PaymentAlertItem["client"] | undefined = row.clientId == null
        ? undefined
        : {_id: String(row.clientId), name: row.clientName, surname: row.clientSurname};
    const currency = currencyOfLine(row);
    return {
        kind,
        unit: {
            _id: row.unitId?.toString?.() ?? "",
            unitNumber: row.unitNumber,
            name: row.unitName,
        },
        ...(client ? {client} : {}),
        installment: {
            amount: kind === "installment" ? installmentLeft(row) : toNumber(row.amount),
            dueDate,
        },
        ...(currency ? {currency} : {}),
        daysUntilDue: calendarDaysUntil(dueDate, today),
        ...(kind === "reservation"
            ? { reservationId: row.reservationId?.toString?.() ?? row._id?.toString?.() }
            : {}),
        ...(kind === "installment" && row.saleId
            ? { saleId: row.saleId?.toString?.() ?? String(row.saleId) }
            : {}),
    };
}

/** Installments, reservation deposits and rent coming due, soonest first, at most 50. */
function paymentAlertsOf(installmentRows: AlertSourceRow[], reservationRows: AlertSourceRow[], rentAlerts: PaymentAlertItem[], today: string): PaymentAlertItem[] {
    return [
        // A fully paid installment whose status lags behind owes nothing, so it raises no alert.
        ...installmentRows.filter((row) => installmentLeft(row) > 0).map((row) => alertOf(row, "installment", today)),
        ...reservationRows.map((row) => alertOf(row, "reservation", today)),
        ...rentAlerts,
    ]
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
        .slice(0, 50);
}

async function getDashboardStats(
    params: DashboardParams
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
    const opts: DashboardOpts = {logger, languageCode, withDeleted: false};
    const access = dashboardReadAccess(actionUserCtx, languageCode);
    assertAnyCollectedRead(access.any, languageCode);

    // Cache check — return pre-computed result if still fresh (< 5 min old)
    const cacheKey = buildDashboardCacheKey(company._id.toString(), {projectId, edificeId, period, from, to, recentSalesLimit});
    try {
        const cached = await dashboardCacheService.findByKey(cacheKey);
        if (cached && cached.computedAt && Date.now() - new Date(cached.computedAt).getTime() < DASHBOARD_CACHE_TTL_MS) {
            logger.finish("Dashboard stats served from cache.");
            const cachedResult = cached.result as {
                rawSummary: DashboardSummary;
                revenueByPeriod: PeriodDatum[];
                salesByPeriod: PeriodDatum[];
                recentSales: RecentSaleItem[];
                paymentAlerts?: PaymentAlertItem[];
            };
            return sanitizeDashboardResponse(cachedResult, actionUserCtx, languageCode);
        }
    } catch {
        // Cache read failure is non-fatal — fall through to compute
    }

    // Build unit filter using denormalized project/edifice fields (avoids 3-hop fan-out)
    const unitFilter: Record<string, unknown> = {company: company._id};
    if (projectId && ObjectId.isValid(projectId)) unitFilter.project = new ObjectId(projectId);
    else if (edificeId && ObjectId.isValid(edificeId)) unitFilter.edifice = new ObjectId(edificeId);

    const companyUnits = access.needsUnitScope
        ? await unitService.find(unitFilter, opts, null, "_id", {}, undefined, undefined)
        : [];
    const unitIds = companyUnits
        .map((u) => u._id)
        .filter((id): id is ObjectId => id != null);

    if (unitIds.length === 0) {
        const counts = await hierarchyCounts({params, access, opts});
        const emptySummary = buildEmptySummary();
        emptySummary.totalProjects = counts.projects;
        emptySummary.totalEdifices = counts.edifices;
        emptySummary.totalFloors = counts.floors;
        logger.finish("Dashboard stats (no units).");
        return sanitizeDashboardResponse({
            rawSummary: emptySummary,
            revenueByPeriod: [],
            salesByPeriod: [],
            recentSales: [],
        }, actionUserCtx, languageCode);
    }

    // Sale, due and expiry days are local `YYYY-MM-DD` strings (D115): bounds are days, compared as text, and
    // "today" is the company's.
    const today = localDateOf(new Date(), params.companyTimeZone);
    const fromDay = from ? from.slice(0, 10) : undefined;
    const toDay = to ? to.slice(0, 10) : undefined;
    const saleDays: DashboardScope["saleDays"] = {};
    if (fromDay) saleDays.$gte = fromDay;
    if (toDay) saleDays.$lte = toDay;

    const periodMonths = period === "week" ? 3 : 12;
    const [todayYear, todayMonth, todayDate] = today.split("-").map(Number);
    const startPeriod = localDateOf(new Date(Date.UTC(todayYear, todayMonth - 1 - periodMonths, todayDate)), "UTC");

    const scope: DashboardScope = {
        params,
        opts,
        access,
        unitIds,
        today,
        saleDays,
        periodStart: fromDay ?? startPeriod,
        periodEnd: toDay ?? today,
        expiringEnd: addLocalDays(today, 7),
        alertHorizon: addLocalDays(today, 30),
    };

    const [counts, sales, units, reservations, paymentPlans, inspections, modificationRequestsByStatus, unitCosts, rentals, collected] = await Promise.all([
        hierarchyCounts(scope),
        salesStats(scope),
        unitStats(scope),
        reservationStats(scope),
        paymentPlanStats(scope),
        inspectionStats(scope),
        modificationRequestStats(scope),
        unitCostStats(scope),
        rentalStats(scope),
        collectedStats(scope),
    ]);

    const totalUnitsCount = unitIds.length;
    const occupancyRatePercent = totalUnitsCount > 0 ? (units.unitsByStatus.sold / totalUnitsCount) * 100 : 0;
    const totalInspections = Object.values(inspections.byStatus).reduce((a, b) => a + b, 0);
    const TERMINAL_MODIFICATION_STATUSES = ["completed", "rejected", "cancelled"];
    const openModificationRequests = Object.entries(modificationRequestsByStatus).reduce(
        (sum, [status, count]) => (TERMINAL_MODIFICATION_STATUSES.includes(status) ? sum : sum + count),
        0
    );

    const summary: DashboardSummary = {
        totalRevenue: sales.totalRevenue,
        collected,
        totalSales: sales.totalSales,
        totalUnits: unitIds.length,
        totalProjects: counts.projects,
        totalEdifices: counts.edifices,
        totalFloors: counts.floors,
        unitsByStatus: units.unitsByStatus,
        activeReservations: reservations.activeReservations,
        paymentPlans: {
            byStatus: paymentPlans.byStatus,
            totalOutstanding: paymentPlans.totalOutstanding,
            overdueInstallmentsCount: paymentPlans.overdueInstallmentsCount,
        },
        inspections: {
            byStatus: inspections.byStatus,
            followUpRequiredCount: inspections.followUpRequiredCount,
        },
        modificationRequests: {
            byStatus: modificationRequestsByStatus,
        },
        averageSalePrice: sales.averageSalePrice,
        inventoryValue: units.inventoryValue,
        salesByPaymentType: sales.salesByPaymentType,
        occupancyRatePercent,
        totalInspections,
        openModificationRequests,
        expiringReservationsCount: reservations.expiringReservationsCount,
        totalReservationDeposits: reservations.totalReservationDeposits,
        paymentPlansCompleted: paymentPlans.byStatus.completed,
        paymentPlansDefaulted: paymentPlans.byStatus.defaulted,
        verifiedPaidUnitCosts: unitCosts.verifiedPaid,
        verifiedOutstandingUnitCosts: unitCosts.verifiedOutstanding,
        pendingVerificationUnitCosts: unitCosts.pending,
        totalUnitCostDocuments: unitCosts.documents,
        rentals: rentals.rentals,
    };

    const {revenueByPeriod, salesByPeriod, recentSales} = sales;
    const paymentAlerts = paymentAlertsOf(paymentPlans.alertRows, reservations.alertRows, rentals.rentAlerts, today);

    if (access.all) {
        dashboardCacheService.store(
            {cacheKey},
            {$set: {company: company._id, result: {rawSummary: summary, revenueByPeriod, salesByPeriod, recentSales, paymentAlerts}, computedAt: new Date()}},
        ).catch(() => { /* cache write failure is non-fatal */ });
    }

    logger.finish("Dashboard stats done.");

    return sanitizeDashboardResponse({
        rawSummary: summary,
        revenueByPeriod,
        salesByPeriod,
        recentSales,
        paymentAlerts,
    }, actionUserCtx, languageCode);
}

function buildEmptySummary(): DashboardSummary {
    return {
        totalRevenue: [],
        collected: [],
        totalSales: 0,
        totalUnits: 0,
        totalProjects: 0,
        totalEdifices: 0,
        totalFloors: 0,
        unitsByStatus: { available: 0, unavailable: 0, reserved: 0, sold: 0, leased: 0 },
        activeReservations: 0,
        paymentPlans: {
            byStatus: { active: 0, completed: 0, defaulted: 0, cancelled: 0 },
            totalOutstanding: [],
            overdueInstallmentsCount: 0,
        },
        inspections: { byStatus: {}, followUpRequiredCount: 0 },
        modificationRequests: { byStatus: {} },
        averageSalePrice: [],
        inventoryValue: [],
        salesByPaymentType: { cash: 0, payment_plan: 0 },
        occupancyRatePercent: 0,
        totalInspections: 0,
        openModificationRequests: 0,
        expiringReservationsCount: 0,
        totalReservationDeposits: [],
        paymentPlansCompleted: 0,
        paymentPlansDefaulted: 0,
        verifiedPaidUnitCosts: [],
        verifiedOutstandingUnitCosts: [],
        pendingVerificationUnitCosts: [],
        totalUnitCostDocuments: 0,
        rentals: emptyRentalsSummary(),
    };
}

function sanitizeDashboardSummary(
    summary: DashboardSummary,
    actionUserCtx: UserContext,
    languageCode: string
): DashboardSummary {
    const access = dashboardReadAccess(actionUserCtx, languageCode);
    const out = { ...summary };

    if (!access.sales) {
        out.totalRevenue = [];
        out.totalSales = 0;
        out.averageSalePrice = [];
        out.salesByPaymentType = { cash: 0, payment_plan: 0 };
    }
    if (!access.sales || !access.paymentPlans || !access.reservations) {
        out.collected = [];
    }
    if (!access.units) {
        out.unitsByStatus = { available: 0, unavailable: 0, reserved: 0, sold: 0, leased: 0 };
        out.totalUnits = 0;
        out.inventoryValue = [];
        out.occupancyRatePercent = 0;
    }
    if (!access.projects) {
        out.totalProjects = 0;
    }
    if (!access.edifices) {
        out.totalEdifices = 0;
    }
    if (!access.floors) {
        out.totalFloors = 0;
    }
    if (!access.reservations) {
        out.activeReservations = 0;
        out.expiringReservationsCount = 0;
        out.totalReservationDeposits = [];
    }
    if (!access.paymentPlans) {
        out.paymentPlans = {
            byStatus: { active: 0, completed: 0, defaulted: 0, cancelled: 0 },
            totalOutstanding: [],
            overdueInstallmentsCount: 0,
        };
        out.paymentPlansCompleted = 0;
        out.paymentPlansDefaulted = 0;
    }
    if (!access.inspections) {
        out.inspections = { byStatus: {}, followUpRequiredCount: 0 };
        out.totalInspections = 0;
    }
    if (!access.modificationRequests) {
        out.modificationRequests = { byStatus: {} };
        out.openModificationRequests = 0;
    }
    if (!access.unitCosts) {
        out.verifiedPaidUnitCosts = [];
        out.verifiedOutstandingUnitCosts = [];
        out.pendingVerificationUnitCosts = [];
        out.totalUnitCostDocuments = 0;
    }
    if (!access.rentalPayments || !access.leases) {
        const rentals = emptyRentalsSummary();
        if (access.rentalPayments) {
            rentals.collectedAmount = out.rentals.collectedAmount;
            rentals.outstandingAmount = out.rentals.outstandingAmount;
            rentals.overdueAmount = out.rentals.overdueAmount;
            rentals.overdueCount = out.rentals.overdueCount;
        }
        if (access.leases) {
            rentals.activeLeases = out.rentals.activeLeases;
        }
        out.rentals = rentals;
    }

    return out;
}

function sanitizeDashboardResponse(
    result: {
        rawSummary?: DashboardSummary;
        summary?: DashboardSummary;
        revenueByPeriod: PeriodDatum[];
        salesByPeriod: PeriodDatum[];
        recentSales: RecentSaleItem[];
        paymentAlerts?: PaymentAlertItem[];
    },
    actionUserCtx: UserContext,
    languageCode: string,
): DashboardFormResponseType {
    const access = dashboardReadAccess(actionUserCtx, languageCode);
    const summary = sanitizeDashboardSummary(result.rawSummary ?? result.summary ?? buildEmptySummary(), actionUserCtx, languageCode);
    const revenueByPeriod = access.sales ? result.revenueByPeriod : [];
    const salesByPeriod = access.sales ? result.salesByPeriod : [];
    const recentSales = access.sales ? result.recentSales : [];
    const paymentAlerts = (result.paymentAlerts ?? []).filter((alert) => {
        if (alert.kind === "installment") return access.paymentPlans;
        if (alert.kind === "reservation") return access.reservations;
        if (alert.kind === "rent") return access.rentalPayments;
        return false;
    });
    return {summary, revenueByPeriod, salesByPeriod, recentSales, paymentAlerts};
}

export const basePath = "/api/realEstate/dashboard";
export { router };
