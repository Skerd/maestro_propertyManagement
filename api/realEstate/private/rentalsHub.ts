import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {rentalPaymentService} from "../../../database/schemas/rentalPayment/rentalPayment.service";
import {RentalPaymentStatus} from "../../../database/schemas/rentalPayment/rentalPayment";
import {leaseService} from "../../../database/schemas/lease/lease.service";
import type {RevenueByCurrency} from "armonia/src/modules/propertyManagement/api/realEstate/private/dashboard/dashboard.form.response.type";
import {
    moneyNumber,
    moneyToScaled,
    remainingScaled,
    scaledToDecimal128,
    type RentMoneyRow,
} from "@propertyManagement/utilities/lease/rentRemaining";
import {resolveHubUnitIds} from "../../../utilities/hubShared/resolveHubUnitIds";
import {inDayRange, monthDayRange, parseDayRange} from "../../../utilities/hubShared/dayRange";
import type {
    LeasesListResponseType,
    RentalPaymentsListResponseType,
    RentalsCalendarResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.response.type";
import type {
    LeasesListFormType,
    RentalPaymentsListFormType,
    RentalsCalendarFormType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.form.type";
import {
    leasesListFormSchema,
    rentalPaymentsListFormSchema,
    rentalsCalendarFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.form.validator";
import type {LeaseRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.lease.dto";
import type {RentalPaymentRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.payment.dto";
import {
    leaseToRegistryRow,
    rentalPaymentToRegistryRow,
    RENTALS_HUB_LEASE_POPULATE,
    RENTALS_HUB_PAYMENT_POPULATE,
} from "../../../utilities/rentalsHub/rentalsHubMapper.dto";
import {
    matchesSearch,
    paginateRows,
} from "../../../utilities/contractsHub/contractsHubMapper.dto";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
    type CollectedFieldReader,
    collectedFieldReader,
    omitRowKeys,
    type RowFieldSources,
    unreadableRowKeys,
} from "@propertyManagement/utilities/security/canReadCollectedFields";

export const basePath = "/api/realEstate/rentalsHub";
export const router = Router();

router.post(
    "/leases/list",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(leasesListFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & LeasesListFormType) => {
        return listLeases(params);
    }),
);

router.post(
    "/rentalPayments/list",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(rentalPaymentsListFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & RentalPaymentsListFormType) => {
        return listRentalPayments(params);
    }),
);

router.post(
    "/rentalPayments/calendar",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(rentalsCalendarFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & RentalsCalendarFormType) => {
        return listRentalPaymentsCalendar(params);
    }),
);

/** Cap on the rows one calendar month may return. */
const CALENDAR_MAX_ROWS = 5000;

const LEASE = "leases";
const RENT = "rentalpayments";

/** Field-level read (SEC-09): where each lease row field comes from. */
const LEASE_ROW_SOURCES: RowFieldSources<LeaseRegistryRow> = {
    name: [[LEASE, "name"]],
    status: [[LEASE, "status"]],
    startDate: [[LEASE, "startDate"]],
    endDate: [[LEASE, "endDate"]],
    monthlyRent: [[LEASE, "monthlyRent"]],
    currency: [[LEASE, "rentCurrency"]],
    depositAmount: [[LEASE, "depositAmount"]],
    depositPaid: [[LEASE, "depositPaid"]],
    tenant: [[LEASE, "tenant"]],
    unit: [[LEASE, "unit"]],
    project: [[LEASE, "unit"]],
    createdAt: [[LEASE, "createdAt"]],
};

/** Field-level read (SEC-09): where each rent payment row field comes from. */
const PAYMENT_ROW_SOURCES: RowFieldSources<RentalPaymentRegistryRow> = {
    name: [[RENT, "name"]],
    status: [[RENT, "status"]],
    dueDate: [[RENT, "dueDate"]],
    amount: [[RENT, "amount"]],
    paidAmount: [[RENT, "paidAmount"]],
    remaining: [[RENT, "amount"], [RENT, "paidAmount"], [RENT, "lateFeeAmount"]],
    lateFeeAmount: [[RENT, "lateFeeAmount"]],
    paidDate: [[RENT, "paidDate"]],
    currency: [[RENT, "currency"]],
    lease: [[RENT, "lease"], [LEASE, "name"]],
    tenant: [[RENT, "lease"], [LEASE, "tenant"]],
    unit: [[RENT, "unit"]],
    project: [[RENT, "unit"]],
    createdAt: [[RENT, "createdAt"]],
};

/** Collected = paid amounts; outstanding / overdue = amount + late fee − paid; overdue also needs the status. */
function rentTotalsAccess(read: CollectedFieldReader): {collected: boolean; outstanding: boolean; overdue: boolean} {
    const paid = read(RENT, "paidAmount");
    const outstanding = paid && read(RENT, "amount") && read(RENT, "lateFeeAmount");
    return {
        collected: paid,
        outstanding,
        overdue: outstanding && read(RENT, "status"),
    };
}

async function listLeases(
    params: AuthenticatedMWType & LeasesListFormType,
): Promise<LeasesListResponseType> {
    const {
        logger,
        company,
        search,
        project,
        edifice,
        floor,
        unit,
        status,
        startDateFrom,
        startDateTo,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing rentals hub leases...");
    assertAnyCollectedRead(
        canReadCollectedFields("leases", params.actionUserCtx, params.languageCode),
        params.languageCode,
    );

    const companyId = company._id;
    const unitIds = await resolveHubUnitIds({project, edifice, floor, unit, company, logger, languageCode: params.languageCode});
    const dateRange = parseDayRange(startDateFrom, startDateTo);

    const match: Record<string, unknown> = {
        company: companyId,
    };
    if (unitIds) match.unit = {$in: unitIds};
    const read = collectedFieldReader(params.actionUserCtx, params.languageCode);
    // A status the caller may not read is no filter (SEC-09), like the hidden date filters below.
    if (status && read(LEASE, "status")) match.status = status;

    const docs = await leaseService.find(
        match,
        {logger, languageCode: params.languageCode, withDeleted: false},
        RENTALS_HUB_LEASE_POPULATE,
        undefined,
        {createdAt: -1},
    );

    const hidden = unreadableRowKeys(LEASE_ROW_SOURCES, read);
    const canFilterByStart = read(LEASE, "startDate");
    const matched: LeaseRegistryRow[] = [];
    for (const doc of docs) {
        if (canFilterByStart && !inDayRange(doc.startDate, dateRange)) continue;
        const row = omitRowKeys(leaseToRegistryRow(doc as unknown as Record<string, unknown>), hidden);
        if (
            !matchesSearch(search, [
                row.name,
                row.tenant?.name,
                row.tenant?.surname,
                row.tenant?.email,
                row.unit?.name,
                row.unit?.unitNumber != null ? String(row.unit.unitNumber) : undefined,
                row.project?.name,
            ])
        ) continue;
        matched.push(row);
    }

    const paginated = paginateRows(matched, page, limit);
    const pageIds = paginated.data.map((row) => new ObjectId(row._id));
    const totalsAccess = rentTotalsAccess(read);
    if (pageIds.length > 0 && read(RENT, "lease") && (totalsAccess.collected || totalsAccess.outstanding)) {
        const payments = await rentalPaymentService.find(
            {lease: {$in: pageIds}, company: companyId},
            {logger, languageCode: params.languageCode, withDeleted: false},
        );
        const totals = totalsByLease(payments);
        paginated.data = paginated.data.map((row) => {
            const t = totals.get(row._id);
            return {
                ...row,
                ...(totalsAccess.collected ? {collectedAmount: t?.collected ?? 0} : {}),
                ...(totalsAccess.outstanding ? {outstandingAmount: t?.outstanding ?? 0} : {}),
            };
        });
    }

    logger.finish(`Rentals hub leases: ${paginated.total} rows`);
    return paginated;
}

async function listRentalPayments(
    params: AuthenticatedMWType & RentalPaymentsListFormType,
): Promise<RentalPaymentsListResponseType> {
    const {
        logger,
        company,
        search,
        project,
        edifice,
        floor,
        unit,
        payment,
        status,
        dueDateFrom,
        dueDateTo,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing rentals hub payments...");
    assertAnyCollectedRead(
        canReadCollectedFields("rentalpayments", params.actionUserCtx, params.languageCode),
        params.languageCode,
    );

    const companyId = company._id;
    const unitIds = await resolveHubUnitIds({project, edifice, floor, unit, company, logger, languageCode: params.languageCode});
    const dateRange = parseDayRange(dueDateFrom, dueDateTo);

    const match: Record<string, unknown> = {
        company: companyId,
    };
    if (payment && ObjectId.isValid(payment)) match._id = new ObjectId(payment);
    if (unitIds) match.unit = {$in: unitIds};
    const read = collectedFieldReader(params.actionUserCtx, params.languageCode);
    if (status && read(RENT, "status")) match.status = status;

    const docs = await rentalPaymentService.find(
        match,
        {logger, languageCode: params.languageCode, withDeleted: false},
        RENTALS_HUB_PAYMENT_POPULATE,
        undefined,
        {dueDate: -1},
    );

    const hidden = unreadableRowKeys(PAYMENT_ROW_SOURCES, read);
    const canFilterByDue = read(RENT, "dueDate");
    const rows: RentalPaymentRegistryRow[] = [];
    for (const doc of docs) {
        if (canFilterByDue && !inDayRange(doc.dueDate, dateRange)) continue;
        const row = omitRowKeys(rentalPaymentToRegistryRow(doc as unknown as Record<string, unknown>), hidden);
        if (
            !matchesSearch(search, [
                row.name,
                row.lease?.name,
                row.tenant?.name,
                row.tenant?.surname,
                row.unit?.name,
                row.unit?.unitNumber != null ? String(row.unit.unitNumber) : undefined,
                row.project?.name,
                row.status,
            ])
        ) continue;
        rows.push(row);
    }

    const paginated = paginateRows(rows, page, limit);
    logger.finish(`Rentals hub payments: ${paginated.total} rows`);
    return paginated;
}

function totalsByLease(payments: (RentMoneyRow & {lease?: unknown})[]): Map<string, {collected: number; outstanding: number}> {
    const collected = new Map<string, bigint>();
    const outstanding = new Map<string, bigint>();
    for (const payment of payments) {
        const leaseId = leaseIdOf(payment.lease);
        if (!leaseId) continue;
        collected.set(leaseId, (collected.get(leaseId) ?? 0n) + moneyToScaled(payment.paidAmount));
        if (payment.status !== RentalPaymentStatus.WAIVED) {
            outstanding.set(leaseId, (outstanding.get(leaseId) ?? 0n) + remainingScaled(payment));
        }
    }
    const out = new Map<string, {collected: number; outstanding: number}>();
    const ids = new Set([...collected.keys(), ...outstanding.keys()]);
    for (const id of ids) {
        out.set(id, {
            collected: moneyNumber(scaledToDecimal128(collected.get(id) ?? 0n)),
            outstanding: moneyNumber(scaledToDecimal128(outstanding.get(id) ?? 0n)),
        });
    }
    return out;
}

function leaseIdOf(lease: unknown): string | undefined {
    if (lease == null) return undefined;
    if (typeof lease === "object" && lease !== null && "_id" in lease) {
        return String((lease as {_id: unknown})._id);
    }
    return String(lease);
}

function addRevenue(
    map: Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>,
    payment: RentMoneyRow & {currency?: unknown},
    kind: "collected" | "outstanding" | "overdue",
): void {
    const currency = payment.currency as {_id?: unknown; name?: string; symbol?: string} | undefined;
    const currencyId = currency?._id != null ? String(currency._id) : "_none";
    let add = 0n;
    if (kind === "collected") add = moneyToScaled(payment.paidAmount);
    else if (payment.status === RentalPaymentStatus.WAIVED) add = 0n;
    else {
        const rem = remainingScaled(payment);
        if (kind === "overdue" && payment.status !== RentalPaymentStatus.OVERDUE) add = 0n;
        else add = rem;
    }
    const prev = map.get(currencyId) ?? {
        currencyId,
        currencyName: currency?.name,
        currencySymbol: currency?.symbol,
        scaled: 0n,
    };
    prev.scaled += add;
    map.set(currencyId, prev);
}

function revenueMapToList(
    map: Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>,
): RevenueByCurrency[] {
    return [...map.values()]
        .filter((row) => row.scaled !== 0n)
        .map((row) => ({
            currencyId: row.currencyId,
            currencyName: row.currencyName,
            currencySymbol: row.currencySymbol,
            value: moneyNumber(scaledToDecimal128(row.scaled)),
        }));
}

async function listRentalPaymentsCalendar(
    params: AuthenticatedMWType & RentalsCalendarFormType,
): Promise<RentalsCalendarResponseType> {
    const {logger, company, project, edifice, floor, unit, month, actionUserCtx, languageCode} = params;
    logger.start("Listing rentals hub calendar...");
    assertAnyCollectedRead(canReadCollectedFields("rentalpayments", actionUserCtx, languageCode), languageCode);

    const unitIds = await resolveHubUnitIds({project, edifice, floor, unit, company, logger, languageCode: params.languageCode});
    const {from, to} = monthDayRange(month);

    const match: Record<string, unknown> = {
        company: company._id,
    };
    if (unitIds) match.unit = {$in: unitIds};

    const kpiPayments = await rentalPaymentService.find(
        match,
        {logger, languageCode: params.languageCode, withDeleted: false},
        [{path: "currency", select: "name symbol abbreviation"}],
        "amount paidAmount lateFeeAmount status currency",
    );
    const read = collectedFieldReader(actionUserCtx, languageCode);
    const totalsAccess = rentTotalsAccess(read);
    const collected = new Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>();
    const outstanding = new Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>();
    const overdue = new Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>();
    for (const payment of kpiPayments) {
        if (totalsAccess.collected) addRevenue(collected, payment, "collected");
        if (totalsAccess.outstanding) addRevenue(outstanding, payment, "outstanding");
        if (totalsAccess.overdue) addRevenue(overdue, payment, "overdue");
    }

    // A calendar places rows by due day: a caller who may not read it gets no month rows, so the month cannot reveal
    // the hidden day (SEC-09, as in the payments hub calendar).
    const monthDocs = read(RENT, "dueDate")
        ? await rentalPaymentService.find(
            {...match, dueDate: {$gte: from, $lte: to}},
            {logger, languageCode: params.languageCode, withDeleted: false},
            RENTALS_HUB_PAYMENT_POPULATE,
            undefined,
            {dueDate: 1},
            CALENDAR_MAX_ROWS + 1,
        )
        : [];
    const truncated = monthDocs.length > CALENDAR_MAX_ROWS;
    const hidden = unreadableRowKeys(PAYMENT_ROW_SOURCES, read);
    const payments = monthDocs.slice(0, CALENDAR_MAX_ROWS).map((doc) =>
        omitRowKeys(rentalPaymentToRegistryRow(doc as unknown as Record<string, unknown>), hidden),
    );

    logger.finish(`Rentals hub calendar: ${payments.length} month rows`);
    return {
        month,
        truncated,
        payments,
        kpis: {
            collectedAmount: revenueMapToList(collected),
            outstandingAmount: revenueMapToList(outstanding),
            overdueAmount: revenueMapToList(overdue),
        },
    };
}
