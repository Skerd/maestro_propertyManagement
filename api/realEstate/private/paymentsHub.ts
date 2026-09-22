import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {paymentPlanService} from "../../../database/schemas/paymentPlan/paymentPlan.service";
import {saleService} from "../../../database/schemas/sale/sale.service";
import type {
    PaymentsCalendarResponseType,
    PaymentsListResponseType,
    PaymentsSummaryResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.response.type";
import type {
    PaymentsCalendarFormType,
    PaymentsListFormType,
    PaymentsSummaryFormType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.form.type";
import {
    paymentsCalendarFormSchema,
    paymentsListFormSchema,
    paymentsSummaryFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.form.validator";
import type {
    PaymentsHubPeriodRow,
    PaymentsHubRow,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";
import type {
    PaymentsHubDateField,
    PaymentsHubGroupBy,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.constants";
import {
    addToBuckets,
    bucketsToRevenue,
    type CurrencyBucket,
    PAYMENTS_HUB_PLAN_POPULATE,
    planToHubRows,
    startOfUtcDay,
} from "../../../utilities/paymentsHub/paymentsHubMapper.dto";
import {resolveHubUnitIds} from "../../../utilities/hubShared/resolveHubUnitIds";
import {matchesSearch, paginateRows} from "../../../utilities/contractsHub/contractsHubMapper.dto";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
} from "@propertyManagement/utilities/security/canReadCollectedFields";

export const basePath = "/api/realEstate/paymentsHub";
export const router = Router();

router.post(
    "/payments/list",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(paymentsListFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & PaymentsListFormType) => {
        return listPayments(params);
    }),
);

router.post(
    "/payments/calendar",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(paymentsCalendarFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & PaymentsCalendarFormType) => {
        return listPaymentsCalendar(params);
    }),
);

router.post(
    "/payments/summary",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(paymentsSummaryFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & PaymentsSummaryFormType) => {
        return summarisePayments(params);
    }),
);

/** Plans scanned per request; each plan expands to its down payment plus every installment. */
const PLAN_SCAN_CAP = 5000;
const CALENDAR_MAX_ROWS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

type ScopeParams = AuthenticatedMWType & {
    search?: string;
    project?: string;
    edifice?: string;
    floor?: string;
    unit?: string;
    sale?: string;
    plan?: string;
    status?: PaymentsHubRow["status"];
    kind?: PaymentsHubRow["kind"];
};

/**
 * Every endpoint here reads the same two models: plans hold the money, and the
 * sale behind each plan holds the unit, project, buyer and currency.
 */
function assertPaymentsHubAccess(params: AuthenticatedMWType): void {
    assertAnyCollectedRead(
        canReadCollectedFields("paymentplans", params.actionUserCtx, params.languageCode),
        params.languageCode,
    );
    assertAnyCollectedRead(
        canReadCollectedFields("sales", params.actionUserCtx, params.languageCode),
        params.languageCode,
    );
}

/** UTC day bounds, so a filter means the same thing wherever the server runs. */
function parseUtcDateRange(from?: string, to?: string): {from?: Date; to?: Date} {
    const range: {from?: Date; to?: Date} = {};
    if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) {
            range.from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }
    }
    if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
            range.to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
        }
    }
    return range;
}

function rowDate(row: PaymentsHubRow, dateField: PaymentsHubDateField): Date | undefined {
    const raw = dateField === "paidDate" ? row.paidDate : row.dueDate;
    if (!raw) return undefined;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function inRange(date: Date | undefined, range: {from?: Date; to?: Date}): boolean {
    if (!range.from && !range.to) return true;
    if (!date) return false;
    if (range.from && date < range.from) return false;
    if (range.to && date > range.to) return false;
    return true;
}

function rowMatchesSearch(row: PaymentsHubRow, search?: string): boolean {
    return matchesSearch(search, [
        row.saleCode,
        row.planCode,
        row.client?.name,
        row.client?.surname,
        row.client?.companyName,
        row.unit?.name,
        row.unit?.unitNumber != null ? String(row.unit.unitNumber) : undefined,
        row.project?.name,
        row.status,
    ]);
}

/**
 * Load every payment-plan row the caller's filters allow. Plans are read through
 * the service (company-scoped, soft deletes out) and flattened in memory, the way
 * the rentals hub builds its registry rows.
 */
async function loadScopedRows(params: ScopeParams): Promise<{rows: PaymentsHubRow[]; truncated: boolean}> {
    const {logger, company, project, edifice, floor, unit, sale, plan, languageCode} = params;
    const opts = {logger, languageCode, withDeleted: false as const};

    const match: Record<string, unknown> = {company: company._id, deletedAt: null};
    if (plan && ObjectId.isValid(plan)) match._id = new ObjectId(plan);

    const saleIds: ObjectId[] = [];
    if (sale && ObjectId.isValid(sale)) saleIds.push(new ObjectId(sale));

    const unitIds = await resolveHubUnitIds({project, edifice, floor, unit, company, logger, languageCode});
    if (unitIds) {
        if (unitIds.length === 0) return {rows: [], truncated: false};
        const sales = await saleService.find(
            {company: company._id, deletedAt: null, unit: {$in: unitIds}},
            opts as Parameters<typeof saleService.find>[1],
            [],
            "_id",
            {},
            10_000,
            0,
        );
        const scopedIds = sales.map((s) => s._id as ObjectId);
        if (scopedIds.length === 0) return {rows: [], truncated: false};
        // A `sale` filter on top of the hierarchy must satisfy both.
        if (saleIds.length > 0) {
            const allowed = new Set(scopedIds.map((id) => id.toString()));
            const narrowed = saleIds.filter((id) => allowed.has(id.toString()));
            if (narrowed.length === 0) return {rows: [], truncated: false};
            match.sale = {$in: narrowed};
        } else {
            match.sale = {$in: scopedIds};
        }
    } else if (saleIds.length > 0) {
        match.sale = {$in: saleIds};
    }

    const docs = await paymentPlanService.find(
        match,
        opts as Parameters<typeof paymentPlanService.find>[1],
        PAYMENTS_HUB_PLAN_POPULATE,
        undefined,
        {startDate: 1},
        PLAN_SCAN_CAP + 1,
        0,
    );
    const truncated = docs.length > PLAN_SCAN_CAP;
    const now = new Date();
    const rows: PaymentsHubRow[] = [];
    for (const doc of docs.slice(0, PLAN_SCAN_CAP)) {
        rows.push(...planToHubRows(doc as unknown as Record<string, any>, now));
    }
    return {rows, truncated};
}

/** Row-level filters: kind, derived status and free-text search. The date range is applied separately. */
function applyRowFilters(rows: PaymentsHubRow[], params: ScopeParams): PaymentsHubRow[] {
    const {kind, status, search} = params;
    return rows.filter((row) => {
        if (kind && row.kind !== kind) return false;
        if (status && row.status !== status) return false;
        return rowMatchesSearch(row, search);
    });
}

function sortByDate(
    rows: PaymentsHubRow[],
    dateField: PaymentsHubDateField,
    sortOrder: "asc" | "desc",
): PaymentsHubRow[] {
    const direction = sortOrder === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
        const aDate = rowDate(a, dateField)?.getTime();
        const bDate = rowDate(b, dateField)?.getTime();
        // Rows without the date sort last whichever way the list is ordered.
        if (aDate == null && bDate == null) return 0;
        if (aDate == null) return 1;
        if (bDate == null) return -1;
        if (aDate === bDate) return (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0);
        return aDate < bDate ? -direction : direction;
    });
}

/** Expected / paid / outstanding per currency. Cancelled rows are money nobody owes, so they are skipped. */
function totalsOf(rows: PaymentsHubRow[]): PaymentsListResponseType["totals"] {
    const expected = new Map<string, CurrencyBucket>();
    const paid = new Map<string, CurrencyBucket>();
    const outstanding = new Map<string, CurrencyBucket>();
    for (const row of rows) {
        if (row.status === "cancelled") continue;
        addToBuckets(expected, row, row.amount);
        addToBuckets(paid, row, row.paidAmount);
        addToBuckets(outstanding, row, row.remaining);
    }
    return {
        expectedAmount: bucketsToRevenue(expected),
        paidAmount: bucketsToRevenue(paid),
        outstandingAmount: bucketsToRevenue(outstanding),
    };
}

async function listPayments(
    params: AuthenticatedMWType & PaymentsListFormType,
): Promise<PaymentsListResponseType> {
    const {logger, page = 1, limit = 10, dateField = "dueDate", dateFrom, dateTo, sortOrder = "asc"} = params;

    logger.start("Listing payments hub rows...");
    assertPaymentsHubAccess(params);

    const {rows, truncated} = await loadScopedRows(params);
    const range = parseUtcDateRange(dateFrom, dateTo);
    const filtered = applyRowFilters(rows, params).filter((row) => {
        const date = rowDate(row, dateField);
        // Listing by payment date only makes sense for rows that were actually paid.
        if (dateField === "paidDate" && !date) return false;
        return inRange(date, range);
    });

    const sorted = sortByDate(filtered, dateField, sortOrder);
    const paginated = paginateRows(sorted, page, limit);

    logger.finish(`Payments hub: ${paginated.total} rows`);
    return {...paginated, totals: totalsOf(filtered), truncated};
}

async function listPaymentsCalendar(
    params: AuthenticatedMWType & PaymentsCalendarFormType,
): Promise<PaymentsCalendarResponseType> {
    const {logger, month} = params;

    logger.start("Listing payments hub calendar...");
    assertPaymentsHubAccess(params);

    const [yearStr, monthStr] = month.split("-");
    const from = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1));
    const to = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0, 23, 59, 59, 999));

    const {rows, truncated: scanTruncated} = await loadScopedRows(params);
    const monthRows = sortByDate(
        applyRowFilters(rows, params).filter((row) => inRange(rowDate(row, "dueDate"), {from, to})),
        "dueDate",
        "asc",
    );

    logger.finish(`Payments hub calendar: ${monthRows.length} month rows`);
    return {
        month,
        truncated: scanTruncated || monthRows.length > CALENDAR_MAX_ROWS,
        payments: monthRows.slice(0, CALENDAR_MAX_ROWS),
    };
}

/** Monday-based week start, in UTC. */
function startOfUtcWeek(date: Date): Date {
    const day = startOfUtcDay(date);
    const weekday = (day.getUTCDay() + 6) % 7;
    return new Date(day.getTime() - weekday * DAY_MS);
}

function periodBounds(date: Date, groupBy: PaymentsHubGroupBy): {start: Date; end: Date} {
    if (groupBy === "month") {
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        return {start, end};
    }
    if (groupBy === "week") {
        const start = startOfUtcWeek(date);
        return {start, end: new Date(start.getTime() + 7 * DAY_MS - 1)};
    }
    const start = startOfUtcDay(date);
    return {start, end: new Date(start.getTime() + DAY_MS - 1)};
}

async function summarisePayments(
    params: AuthenticatedMWType & PaymentsSummaryFormType,
): Promise<PaymentsSummaryResponseType> {
    const {logger, groupBy = "month", dateField = "dueDate", dateFrom, dateTo} = params;

    logger.start("Summarising payments hub...");
    assertPaymentsHubAccess(params);

    const {rows, truncated} = await loadScopedRows(params);
    // Tiles answer "what is owed and what came in", so the status filter is left out
    // of them on purpose; the period table below honours every filter.
    const scoped = applyRowFilters(rows, {...params, status: undefined});

    const now = new Date();
    const today = startOfUtcDay(now);
    const in7Days = new Date(today.getTime() + 7 * DAY_MS - 1);
    const in30Days = new Date(today.getTime() + 30 * DAY_MS - 1);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const overdue = new Map<string, CurrencyBucket>();
    const dueNext7 = new Map<string, CurrencyBucket>();
    const dueNext30 = new Map<string, CurrencyBucket>();
    const collectedThisMonth = new Map<string, CurrencyBucket>();

    for (const row of scoped) {
        if (row.status === "cancelled") continue;
        if (row.status === "overdue") addToBuckets(overdue, row, row.remaining);
        else if (row.status === "pending" || row.status === "partially_paid") {
            const due = rowDate(row, "dueDate");
            if (inRange(due, {from: today, to: in7Days})) addToBuckets(dueNext7, row, row.remaining);
            if (inRange(due, {from: today, to: in30Days})) addToBuckets(dueNext30, row, row.remaining);
        }
        const paidOn = rowDate(row, "paidDate");
        if (paidOn && inRange(paidOn, {from: monthStart, to: monthEnd})) {
            addToBuckets(collectedThisMonth, row, row.paidAmount);
        }
    }

    const range = parseUtcDateRange(dateFrom, dateTo);
    const periodRows = applyRowFilters(rows, params).filter((row) => {
        const date = rowDate(row, dateField);
        if (!date) return false;
        return inRange(date, range);
    });

    type PeriodAcc = {
        start: Date;
        end: Date;
        count: number;
        expected: Map<string, CurrencyBucket>;
        paid: Map<string, CurrencyBucket>;
        outstanding: Map<string, CurrencyBucket>;
    };
    const periods = new Map<string, PeriodAcc>();
    for (const row of periodRows) {
        const date = rowDate(row, dateField);
        if (!date) continue;
        const {start, end} = periodBounds(date, groupBy);
        const key = start.toISOString();
        const acc = periods.get(key) ?? {
            start,
            end,
            count: 0,
            expected: new Map<string, CurrencyBucket>(),
            paid: new Map<string, CurrencyBucket>(),
            outstanding: new Map<string, CurrencyBucket>(),
        };
        acc.count += 1;
        if (row.status !== "cancelled") {
            addToBuckets(acc.expected, row, row.amount);
            addToBuckets(acc.paid, row, row.paidAmount);
            addToBuckets(acc.outstanding, row, row.remaining);
        }
        periods.set(key, acc);
    }

    const periodList: PaymentsHubPeriodRow[] = [...periods.values()]
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((acc) => ({
            periodStart: acc.start.toISOString(),
            periodEnd: acc.end.toISOString(),
            count: acc.count,
            expectedAmount: bucketsToRevenue(acc.expected),
            paidAmount: bucketsToRevenue(acc.paid),
            outstandingAmount: bucketsToRevenue(acc.outstanding),
        }));

    logger.finish(`Payments hub summary: ${periodList.length} ${groupBy} periods`);
    return {
        groupBy,
        kpis: {
            overdueAmount: bucketsToRevenue(overdue),
            dueNext7DaysAmount: bucketsToRevenue(dueNext7),
            dueNext30DaysAmount: bucketsToRevenue(dueNext30),
            collectedThisMonthAmount: bucketsToRevenue(collectedThisMonth),
        },
        periods: periodList,
        truncated,
    };
}
