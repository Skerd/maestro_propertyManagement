import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {paymentPlanService} from "../../../database/schemas/paymentPlan/paymentPlan.service";
import {saleService} from "../../../database/schemas/sale/sale.service";
import {reservationService} from "../../../database/schemas/reservation/reservation.service";
import {SaleApprovalStatus, SalePaymentType} from "../../../database/schemas/sale/sale";
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
    cashSaleToHubRow,
    type CurrencyBucket,
    depositToHubRow,
    PAYMENTS_HUB_PLAN_POPULATE,
    PAYMENTS_HUB_RESERVATION_POPULATE,
    PAYMENTS_HUB_SALE_POPULATE,
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
    type CollectedFieldReader,
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

/** Plans scanned per request (each expands to its down payment plus every installment); cash sales and deposits each have the same cap. */
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
 * sale behind each plan holds the unit, project, buyer and currency. Reservations
 * are optional: a caller who may not read them simply gets no deposit rows.
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
const RES = "reservations";

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
    remaining: [[PLAN, "installments.amount"], [PLAN, "installments.paidAmount"]],
    lateFeeAmount: [[PLAN, "installments.lateFeeAmount"]],
};

/** A cash sale's row: the sale is the whole record, paid in full on its sale day. */
const CASH_SALE_SOURCES: RowFieldSources<PaymentsHubRow> = {
    saleCode: [[SALE, "name"]],
    currency: [[SALE, "saleCurrency"]],
    unit: [[SALE, "unit"]],
    project: [[SALE, "unit"]],
    dueDate: [[SALE, "saleDate"]],
    paidDate: [[SALE, "saleDate"]],
    amount: [[SALE, "finalPrice"]],
    paidAmount: [[SALE, "finalPrice"]],
    remaining: [[SALE, "finalPrice"]],
};

/** A deposit row's day is the paid day, else the reservation day, so it needs both. */
const DEPOSIT_SOURCES: RowFieldSources<PaymentsHubRow> = {
    reservationCode: [[RES, "name"]],
    currency: [[RES, "depositCurrency"]],
    unit: [[RES, "unit"]],
    project: [[RES, "unit"]],
    dueDate: [[RES, "paidDate"], [RES, "reservationDate"]],
    paidDate: [[RES, "paidDate"], [RES, "reservationDate"]],
    amount: [[RES, "depositAmount"]],
    paidAmount: [[RES, "depositAmount"]],
    remaining: [[RES, "depositAmount"]],
};

/**
 * Field-level read (SEC-09): a row keeps only what the caller may read on the records it comes from (the plan and its
 * sale, the cash sale, or the reservation). Applied before search, filters and totals, so hidden amounts and buyers
 * can neither be listed, searched for nor summed.
 */
function rowMasker(read: CollectedFieldReader): (row: PaymentsHubRow) => PaymentsHubRow {
    const hidden: Record<PaymentsHubRow["kind"], ReturnType<typeof unreadableRowKeys<PaymentsHubRow>>> = {
        down_payment: unreadableRowKeys(DOWN_PAYMENT_SOURCES, read),
        installment: unreadableRowKeys(INSTALLMENT_SOURCES, read),
        cash_sale: unreadableRowKeys(CASH_SALE_SOURCES, read),
        reservation_deposit: unreadableRowKeys(DEPOSIT_SOURCES, read),
    };
    // Who may see the client: the sale's buyer (through the plan for plan rows) or buyer company, or the reservation's client.
    const viaPlan = read(PLAN, "sale");
    const clientReadable: Record<PaymentsHubRow["kind"], {person: boolean; company: boolean}> = {
        down_payment: {person: viaPlan && read(SALE, "buyer"), company: viaPlan && read(SALE, "buyerCompany")},
        installment: {person: viaPlan && read(SALE, "buyer"), company: viaPlan && read(SALE, "buyerCompany")},
        cash_sale: {person: read(SALE, "buyer"), company: read(SALE, "buyerCompany")},
        reservation_deposit: {person: read(RES, "client"), company: false},
    };
    return (row) => {
        const masked = omitRowKeys(row, hidden[row.kind]);
        if (!masked.client) return masked;
        // The client is the buyer, or (no buyer) the buyer company, which `mapClient` marks with `companyName`.
        const fromCompany = "companyName" in masked.client;
        const readable = clientReadable[row.kind];
        return (fromCompany ? readable.company : readable.person) ? masked : omitRowKeys(masked, ["client"]);
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
        row.reservationCode,
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
 * Load every hub row the caller's filters allow: payment-plan rows, cash sales and paid reservation deposits. Records
 * are read through the services (company-scoped, soft deletes out) and flattened in memory, the way the rentals hub
 * builds its registry rows. Cash sales and deposits are exactly the ones the dashboard's "Collected" counts.
 */
async function loadScopedRows(params: ScopeParams): Promise<{rows: PaymentsHubRow[]; truncated: boolean}> {
    const {logger, company, project, edifice, floor, unit, sale, plan, kind, languageCode} = params;
    const opts = {logger, languageCode, withDeleted: false as const};

    const match: Record<string, unknown> = {company: company._id};
    if (plan && ObjectId.isValid(plan)) match._id = new ObjectId(plan);

    const saleIds: ObjectId[] = [];
    if (sale && ObjectId.isValid(sale)) saleIds.push(new ObjectId(sale));

    // The sales whose plans are in scope; undefined when nothing narrows them.
    let planSaleIds: ObjectId[] | undefined;
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
        // A `sale` filter on top of the hierarchy must satisfy both.
        if (saleIds.length > 0) {
            const allowed = new Set(scopedIds.map((id) => id.toString()));
            planSaleIds = saleIds.filter((id) => allowed.has(id.toString()));
            if (planSaleIds.length === 0) return {rows: [], truncated: false};
        } else {
            planSaleIds = scopedIds;
        }
    } else if (saleIds.length > 0) {
        planSaleIds = saleIds;
    }
    if (planSaleIds) match.sale = {$in: planSaleIds};

    const today = localDateOf(new Date(), params.companyTimeZone);
    const read = collectedFieldReader(params.actionUserCtx, params.languageCode);
    const mask = rowMasker(read);
    const wants = (rowKind: PaymentsHubRow["kind"]) => !kind || kind === rowKind;
    const unitMatch = unitIds ? {unit: {$in: unitIds}} : {};

    // A plan or sale filter is about a plan's or a sale's payments; a deposit belongs to neither, and a cash sale has no plan.
    // A row's kind is the sale's payment type, or the reservation's paid flag: a caller who may not read that gets no
    // such rows rather than learning it from the row (SEC-09).
    const loadPlans = (wants("installment") || wants("down_payment")) && (!planSaleIds || planSaleIds.length > 0);
    const loadCashSales = wants("cash_sale") && !plan && read(SALE, "paymentType");
    const loadDeposits = wants("reservation_deposit") && !plan && !sale && read(RES, "paid");

    const [planDocs, cashSales, deposits] = await Promise.all([
        loadPlans
            ? paymentPlanService.find(
                match,
                opts as Parameters<typeof paymentPlanService.find>[1],
                PAYMENTS_HUB_PLAN_POPULATE,
                undefined,
                {startDate: 1},
                PLAN_SCAN_CAP + 1,
                0,
            )
            : Promise.resolve([]),
        loadCashSales
            ? saleService.find(
                {
                    company: company._id,
                    ...unitMatch,
                    ...(saleIds.length > 0 ? {_id: {$in: saleIds}} : {}),
                    paymentType: SalePaymentType.CASH,
                    // A rejected sale was never money received; one pending approval was (as "Collected" counts it).
                    approvalStatus: {$ne: SaleApprovalStatus.REJECTED},
                },
                opts as Parameters<typeof saleService.find>[1],
                PAYMENTS_HUB_SALE_POPULATE,
                undefined,
                {saleDate: 1},
                PLAN_SCAN_CAP + 1,
                0,
            )
            : Promise.resolve([]),
        loadDeposits
            ? reservationService.find(
                // A stored deposit, as "Collected" matches it.
                {company: company._id, ...unitMatch, paid: true, depositAmount: {$ne: null}},
                opts as Parameters<typeof reservationService.find>[1],
                PAYMENTS_HUB_RESERVATION_POPULATE,
                undefined,
                {reservationDate: 1},
                PLAN_SCAN_CAP + 1,
                0,
            )
            : Promise.resolve([]),
    ]);
    const truncated = [planDocs, cashSales, deposits].some((docs) => docs.length > PLAN_SCAN_CAP);
    const rows: PaymentsHubRow[] = [];
    for (const doc of planDocs.slice(0, PLAN_SCAN_CAP)) {
        // A plan whose sale was deleted populates no sale (soft delete): "Collected" reads plans through live sales only (TD-B183).
        if (!doc.sale) continue;
        rows.push(...planToHubRows(doc as unknown as Record<string, any>, today, read).map(mask));
    }
    for (const doc of cashSales.slice(0, PLAN_SCAN_CAP)) rows.push(mask(cashSaleToHubRow(doc)));
    for (const doc of deposits.slice(0, PLAN_SCAN_CAP)) rows.push(mask(depositToHubRow(doc)));
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

/**
 * Adds a row to expected / paid / outstanding. A cancelled row is money nobody owes, so it is neither expected nor
 * outstanding, but what was received on it before the cancellation was received: it stays in paid, as the dashboard's
 * "Collected" counts it (TD-B180).
 */
function addRowTotals(
    row: PaymentsHubRow,
    expected: Map<string, CurrencyBucket>,
    paid: Map<string, CurrencyBucket>,
    outstanding: Map<string, CurrencyBucket>,
): void {
    addToBuckets(paid, row, row.paidAmount);
    if (row.status === "cancelled") return;
    addToBuckets(expected, row, row.amount);
    addToBuckets(outstanding, row, row.remaining);
}

/** Expected / paid / outstanding per currency. */
function totalsOf(rows: PaymentsHubRow[]): PaymentsListResponseType["totals"] {
    const expected = new Map<string, CurrencyBucket>();
    const paid = new Map<string, CurrencyBucket>();
    const outstanding = new Map<string, CurrencyBucket>();
    for (const row of rows) addRowTotals(row, expected, paid, outstanding);
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
        // Listing by payment date only makes sense for rows that were actually paid. Without a range, money received on a
        // row that records no paid day still counts, as it does in "Collected" (TD-B183).
        if (dateField === "paidDate" && !date) return !range.from && !range.to && (row.paidAmount ?? 0) > 0;
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
        // Money received counts on its paid day even on a cancelled plan (TD-B180); a cancelled row is never owed.
        const paidOn = rowDate(row, "paidDate");
        if (paidOn && inDayRange(paidOn, thisMonth)) {
            addToBuckets(collectedThisMonth, row, row.paidAmount);
        }
        if (row.status === "cancelled") continue;
        if (row.status === "overdue") addToBuckets(overdue, row, row.remaining);
        else if (row.status === "pending" || row.status === "partially_paid") {
            const due = rowDate(row, "dueDate");
            if (inDayRange(due, next7Days)) addToBuckets(dueNext7, row, row.remaining);
            if (inDayRange(due, next30Days)) addToBuckets(dueNext30, row, row.remaining);
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
        addRowTotals(row, acc.expected, acc.paid, acc.outstanding);
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
