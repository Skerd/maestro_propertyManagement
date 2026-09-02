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
} from "@propertyManagement/utilities/lease/rentRemaining";
import {unitService} from "../../../database/schemas/unit/unit.service";
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
    "/rentalPayments/calendar",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(rentalsCalendarFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & RentalsCalendarFormType) => {
        return listRentalPaymentsCalendar(params);
    }),
);

const CALENDAR_MAX_ROWS = 5000;

type HubScopeParams = {
    project?: string;
    edifice?: string;
    floor?: string;
    unit?: string;
    company: {_id: ObjectId};
    logger: any;
    languageCode: string;
};

async function resolveUnitIds(params: HubScopeParams): Promise<ObjectId[] | undefined> {
    const {project, edifice, floor, unit, company, logger, languageCode} = params;
    const opts = {logger, languageCode, withDeleted: false as const};

    if (unit && ObjectId.isValid(unit)) {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            opts as Parameters<typeof unitService.findOneOrThrow>[1],
        );
        return [foundUnit._id as ObjectId];
    }

    const unitScope: Record<string, unknown> = {company: company._id};
    if (project && ObjectId.isValid(project)) unitScope.project = new ObjectId(String(project));
    if (edifice && ObjectId.isValid(edifice)) unitScope.edifice = new ObjectId(String(edifice));
    if (floor && ObjectId.isValid(floor)) unitScope.floor = new ObjectId(String(floor));
    if (!unitScope.project && !unitScope.edifice && !unitScope.floor) return undefined;

    const units = await unitService.find(
        unitScope,
        opts as Parameters<typeof unitService.find>[1],
        [],
        "_id",
        {},
        10_000,
        0,
    );
    return units.map((u) => u._id as ObjectId);
}

function parseDateRange(from?: string, to?: string): {from?: Date; to?: Date} {
    const result: {from?: Date; to?: Date} = {};
    if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            result.from = d;
        }
    }
    if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
            d.setHours(23, 59, 59, 999);
            result.to = d;
        }
    }
    return result;
}

function inDateRange(value: unknown, range: {from?: Date; to?: Date}): boolean {
    if (!range.from && !range.to) return true;
    if (!value) return false;
    const d = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(d.getTime())) return false;
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
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

    const companyId = company._id;
    const unitIds = await resolveUnitIds({project, edifice, floor, unit, company, logger, languageCode: params.languageCode});
    const dateRange = parseDateRange(startDateFrom, startDateTo);

    const match: Record<string, unknown> = {
        company: companyId,
        deletedAt: null,
    };
    if (unitIds) match.unit = {$in: unitIds};
    if (status) match.status = status;

    const docs = await leaseService.find(
        match,
        {logger, languageCode: params.languageCode, withDeleted: false},
        RENTALS_HUB_LEASE_POPULATE,
        undefined,
        {createdAt: -1},
    );

    const matched: LeaseRegistryRow[] = [];
    for (const doc of docs) {
        if (!inDateRange(doc.startDate, dateRange)) continue;
        const row = leaseToRegistryRow(doc as unknown as Record<string, unknown>);
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
    if (pageIds.length > 0) {
        const payments = await rentalPaymentService.find(
            {lease: {$in: pageIds}, company: companyId, deletedAt: null},
            {logger, languageCode: params.languageCode, withDeleted: false},
        );
        const totals = totalsByLease(payments);
        paginated.data = paginated.data.map((row) => {
            const t = totals.get(row._id);
            return {
                ...row,
                collectedAmount: t?.collected ?? 0,
                outstandingAmount: t?.outstanding ?? 0,
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
        status,
        dueDateFrom,
        dueDateTo,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing rentals hub payments...");

    const companyId = company._id;
    const unitIds = await resolveUnitIds({project, edifice, floor, unit, company, logger, languageCode: params.languageCode});
    const dateRange = parseDateRange(dueDateFrom, dueDateTo);

    const match: Record<string, unknown> = {
        company: companyId,
        deletedAt: null,
    };
    if (unitIds) match.unit = {$in: unitIds};
    if (status) match.status = status;

    const docs = await rentalPaymentService.find(
        match,
        {logger, languageCode: params.languageCode, withDeleted: false},
        RENTALS_HUB_PAYMENT_POPULATE,
        undefined,
        {dueDate: -1},
    );

    const rows: RentalPaymentRegistryRow[] = [];
    for (const doc of docs) {
        if (!inDateRange(doc.dueDate, dateRange)) continue;
        const row = rentalPaymentToRegistryRow(doc as unknown as Record<string, unknown>);
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

function totalsByLease(payments: {lease?: unknown; paidAmount?: unknown; amount?: unknown; lateFeeAmount?: unknown; status?: string}[]): Map<string, {collected: number; outstanding: number}> {
    const collected = new Map<string, bigint>();
    const outstanding = new Map<string, bigint>();
    for (const payment of payments) {
        const leaseId = leaseIdOf(payment.lease);
        if (!leaseId) continue;
        collected.set(leaseId, (collected.get(leaseId) ?? 0n) + moneyToScaled(payment.paidAmount as never));
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
    payment: {currency?: unknown; paidAmount?: unknown; amount?: unknown; lateFeeAmount?: unknown; status?: string},
    kind: "collected" | "outstanding" | "overdue",
): void {
    const currency = payment.currency as {_id?: unknown; name?: string; symbol?: string} | undefined;
    const currencyId = currency?._id != null ? String(currency._id) : "_none";
    let add = 0n;
    if (kind === "collected") add = moneyToScaled(payment.paidAmount as never);
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
    const {logger, company, project, edifice, floor, unit, month} = params;
    logger.start("Listing rentals hub calendar...");

    const unitIds = await resolveUnitIds({project, edifice, floor, unit, company, logger, languageCode: params.languageCode});
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

    const match: Record<string, unknown> = {
        company: company._id,
        deletedAt: null,
    };
    if (unitIds) match.unit = {$in: unitIds};

    const kpiPayments = await rentalPaymentService.find(
        match,
        {logger, languageCode: params.languageCode, withDeleted: false},
        [{path: "currency", select: "name symbol abbreviation"}],
        "amount paidAmount lateFeeAmount status currency",
    );
    const collected = new Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>();
    const outstanding = new Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>();
    const overdue = new Map<string, {currencyId: string; currencyName?: string; currencySymbol?: string; scaled: bigint}>();
    for (const payment of kpiPayments) {
        addRevenue(collected, payment, "collected");
        addRevenue(outstanding, payment, "outstanding");
        addRevenue(overdue, payment, "overdue");
    }

    const monthMatch = {
        ...match,
        dueDate: {$gte: from, $lte: to},
    };
    const monthDocs = await rentalPaymentService.find(
        monthMatch,
        {logger, languageCode: params.languageCode, withDeleted: false},
        RENTALS_HUB_PAYMENT_POPULATE,
        undefined,
        {dueDate: 1},
        CALENDAR_MAX_ROWS + 1,
    );
    const truncated = monthDocs.length > CALENDAR_MAX_ROWS;
    const payments = monthDocs.slice(0, CALENDAR_MAX_ROWS).map((doc) =>
        rentalPaymentToRegistryRow(doc as unknown as Record<string, unknown>),
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
