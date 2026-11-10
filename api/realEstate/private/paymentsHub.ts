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
} from "../../../utilities/paymentsHub/paymentsHubMapper.dto";
import {resolveHubUnitIds} from "../../../utilities/hubShared/resolveHubUnitIds";
import {inDayRange, monthDayRange, parseDayRange} from "../../../utilities/hubShared/dayRange";
import {addLocalDays, localDateOf} from "@coreModule/utilities/time/timeWindows";
import {matchesSearch, paginateRows} from "../../../utilities/contractsHub/contractsHubMapper.dto";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
    collectedFieldReader,
    omitRowKeys,
    type RowFieldSources,
    unreadableRowKeys,
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

const PLAN = "paymentplans";
const SALE = "sales";

/** Row fields that come from the sale behind the plan, or from the plan as a whole. */
const SHARED_SOURCES: RowFieldSources<PaymentsHubRow> = {
    planCode: [[PLAN, "name"]],
    saleId: [[PLAN, "sale"]],
    saleCode: [[PLAN, "sale"], [SALE, "name"]],
    currency: [[PLAN, "sale"], [SALE, "saleCurrency"]],
    unit: [[PLAN, "sale"], [SALE, "unit"]],
    project: [[PLAN, "sale"], [SALE, "unit"]],
};

const DOWN_PAYMENT_SOURCES: RowFieldSources<PaymentsHubRow> = {
    ...SHARED_SOURCES,
    dueDate: [[PLAN, "startDate"]],
    daysOverdue: [[PLAN, "startDate"]],
    paidDate: [[PLAN, "downPaymentDate"]],
    amount: [[PLAN, "downPayment"]],
    paidAmount: [[PLAN, "downPayment"], [PLAN, "downPaymentPaid"]],
    remaining: [[PLAN, "downPayment"], [PLAN, "downPaymentPaid"]],
};

const INSTALLMENT_SOURCES: RowFieldSources<PaymentsHubRow> = {
    ...SHARED_SOURCES,
    installmentNumber: [[PLAN, "installments.installmentNumber"]],
    dueDate: [[PLAN, "installments.dueDate"]],
    daysOverdue: [[PLAN, "installments.dueDate"]],
    paidDate: [[PLAN, "installments.paidDate"], [PLAN, "installments.paymentReceipts"]],
    amount: [[PLAN, "installments.amount"]],
    paidAmount: [[PLAN, "installments.paidAmount"]],
    remaining: [[PLAN, "installments.amount"], [PLAN, "installments.paidAmount"], [PLAN, "installments.lateFeeAmount"]],
    lateFeeAmount: [[PLAN, "installments.lateFeeAmount"]],
};

/**
 * Field-level read (SEC-09): a row keeps only what the caller may read on the plan and its sale. Applied before
 * search, filters and totals, so hidden amounts and buyers can neither be listed, searched for nor summed.
 */
function rowMasker(params: AuthenticatedMWType): (row: PaymentsHubRow) => PaymentsHubRow {
    const read = collectedFieldReader(params.actionUserCtx, params.languageCode);
    const hiddenDownPayment = unreadableRowKeys(DOWN_PAYMENT_SOURCES, read);
    const hiddenInstallment = unreadableRowKeys(INSTALLMENT_SOURCES, read);
    const canReadBuyer = read(PLAN, "sale") && read(SALE, "buyer");
    const canReadBuyerCompany = read(PLAN, "sale") && read(SALE, "buyerCompany");
    return (row) => {
        const masked = omitRowKeys(row, row.kind === "down_payment" ? hiddenDownPayment : hiddenInstallment);
        if (!masked.client) return masked;
        // The client is the buyer, or (no buyer) the buyer company, which `mapClient` marks with `companyName`.
        const fromCompany = "companyName" in masked.client;
        return (fromCompany ? canReadBuyerCompany : canReadBuyer) ? masked : omitRowKeys(masked, ["client"]);
    };
}

/** The row's due or paid day (`YYYY-MM-DD`, D115). */
function rowDate(row: PaymentsHubRow, dateField: PaymentsHubDateField): string | undefined {
    return (dateField === "paidDate" ? row.paidDate : row.dueDate) || undefined;
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

    const match: Record<string, unknown> = {company: company._id};
    if (plan && ObjectId.isValid(plan)) match._id = new ObjectId(plan);

    const saleIds: ObjectId[] = [];
    if (sale && ObjectId.isValid(sale)) saleIds.push(new ObjectId(sale));

    const unitIds = await resolveHubUnitIds({project, edifice, floor, unit, company, logger, languageCode});
    if (unitIds) {
        if (unitIds.length === 0) return {rows: [], truncated: false};
        const sales = await saleService.find(
            {company: company._id, unit: {$in: unitIds}},
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
    const today = localDateOf(new Date(), params.companyTimeZone);
    const mask = rowMasker(params);
    const rows: PaymentsHubRow[] = [];
    for (const doc of docs.slice(0, PLAN_SCAN_CAP)) {
        rows.push(...planToHubRows(doc as unknown as Record<string, any>, today).map(mask));
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
        const aDate = rowDate(a, dateField);
        const bDate = rowDate(b, dateField);
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
    const range = parseDayRange(dateFrom, dateTo);
    const filtered = applyRowFilters(rows, params).filter((row) => {
        const date = rowDate(row, dateField);
        // Listing by payment date only makes sense for rows that were actually paid.
        if (dateField === "paidDate" && !date) return false;
        return inDayRange(date, range);
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

    const monthRange = monthDayRange(month);

    const {rows, truncated: scanTruncated} = await loadScopedRows(params);
    const monthRows = sortByDate(
        applyRowFilters(rows, params).filter((row) => inDayRange(rowDate(row, "dueDate"), monthRange)),
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

/** The period a day falls in, as its first and last day: the calendar month, the Monday-based week, or the day. */
function periodBounds(day: string, groupBy: PaymentsHubGroupBy): {start: string; end: string} {
    if (groupBy === "month") {
        const {from, to} = monthDayRange(day.slice(0, 7));
        return {start: from, end: to};
    }
    if (groupBy === "week") {
        const weekday = (new Date(Date.parse(day)).getUTCDay() + 6) % 7;
        const start = addLocalDays(day, -weekday);
        return {start, end: addLocalDays(start, 6)};
    }
    return {start: day, end: day};
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

    // "Today", the next 7 / 30 days and this month are the company's (GLB-09).
    const today = localDateOf(new Date(), params.companyTimeZone);
    const next7Days = {from: today, to: addLocalDays(today, 6)};
    const next30Days = {from: today, to: addLocalDays(today, 29)};
    const thisMonth = monthDayRange(today.slice(0, 7));

    const overdue = new Map<string, CurrencyBucket>();
    const dueNext7 = new Map<string, CurrencyBucket>();
    const dueNext30 = new Map<string, CurrencyBucket>();
    const collectedThisMonth = new Map<string, CurrencyBucket>();

    for (const row of scoped) {
        if (row.status === "cancelled") continue;
        if (row.status === "overdue") addToBuckets(overdue, row, row.remaining);
        else if (row.status === "pending" || row.status === "partially_paid") {
            const due = rowDate(row, "dueDate");
            if (inDayRange(due, next7Days)) addToBuckets(dueNext7, row, row.remaining);
            if (inDayRange(due, next30Days)) addToBuckets(dueNext30, row, row.remaining);
        }
        const paidOn = rowDate(row, "paidDate");
        if (paidOn && inDayRange(paidOn, thisMonth)) {
            addToBuckets(collectedThisMonth, row, row.paidAmount);
        }
    }

    const range = parseDayRange(dateFrom, dateTo);
    const periodRows = applyRowFilters(rows, params).filter((row) => {
        const date = rowDate(row, dateField);
        if (!date) return false;
        return inDayRange(date, range);
    });

    type PeriodAcc = {
        start: string;
        end: string;
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
        const key = start;
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
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((acc) => ({
            periodStart: acc.start,
            periodEnd: acc.end,
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
