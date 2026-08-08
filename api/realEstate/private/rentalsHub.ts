import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import Lease from "../../../database/schemas/lease/lease";
import RentalPayment from "../../../database/schemas/rentalPayment/rentalPayment";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {
    leasesListFormSchema,
    rentalPaymentsListFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.form.validator";
import type {
    LeasesListFormType,
    RentalPaymentsListFormType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.form.type";
import type {
    LeasesListResponseType,
    RentalPaymentsListResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.response.type";
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
    "/rentalPayments/list",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(rentalPaymentsListFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & RentalPaymentsListFormType) => {
        return listRentalPayments(params);
    }),
);

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

    const docs = await Lease.find(match)
        .populate(RENTALS_HUB_LEASE_POPULATE)
        .sort({createdAt: -1})
        .lean();

    const rows: LeaseRegistryRow[] = [];
    for (const doc of docs) {
        if (!inDateRange((doc as any).startDate, dateRange)) continue;
        const row = leaseToRegistryRow(doc as Record<string, unknown>);
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
        rows.push(row);
    }

    const paginated = paginateRows(rows, page, limit);
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

    const docs = await RentalPayment.find(match)
        .populate(RENTALS_HUB_PAYMENT_POPULATE)
        .sort({dueDate: -1})
        .lean();

    const rows: RentalPaymentRegistryRow[] = [];
    for (const doc of docs) {
        if (!inDateRange((doc as any).dueDate, dateRange)) continue;
        const row = rentalPaymentToRegistryRow(doc as Record<string, unknown>);
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
