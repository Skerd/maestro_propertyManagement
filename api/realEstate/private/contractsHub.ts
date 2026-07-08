import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import Sale, {SalePaymentType} from "../../../database/schemas/sale/sale";
import Reservation, {ReservationStatus} from "../../../database/schemas/reservation/reservation";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {
    clientsListFormSchema,
    contractsListFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.form.validator";
import type {ClientsListFormType, ContractsListFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.form.type";
import type {ClientsListResponseType, ContractsListResponseType} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.response.type";
import type {ContractRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.contract.dto";
import {
    buildClientRegistryRows,
    CONTRACTS_HUB_RESERVATION_POPULATE,
    CONTRACTS_HUB_SALE_POPULATE,
    matchesSearch,
    paginateRows,
    reservationToContractRow,
    saleToContractRow,
} from "../../../utilities/contractsHub/contractsHubMapper.dto";

export const basePath = "/api/realEstate/contractsHub";

const router = Router();
export {router};

router.post(
    "/contracts/list",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(contractsListFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & ContractsListFormType) => {
        return listContracts(params);
    }),
);

router.post(
    "/clients/list",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 60}),
    validateFormZod(clientsListFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & ClientsListFormType) => {
        return listClients(params);
    }),
);

type HubParams = AuthenticatedMWType & ContractsListFormType;

async function resolveUnitIds(
    params: HubParams & {projectId?: string},
): Promise<ObjectId[] | undefined> {
    const {projectId, company, logger, languageCode} = params;
    if (!projectId || !ObjectId.isValid(projectId)) return undefined;

    const units = await unitService.find(
        {project: new ObjectId(projectId), company: company._id},
        {logger, languageCode},
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

async function listContracts(
    params: HubParams & ContractsListFormType,
): Promise<ContractsListResponseType> {
    const {
        logger,
        company,
        search,
        projectId,
        contractType,
        status,
        signatureDateFrom,
        signatureDateTo,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing contracts hub registry...");

    const companyId = company._id;
    const unitIds = await resolveUnitIds({...params, projectId});
    const dateRange = parseDateRange(signatureDateFrom, signatureDateTo);
    const rows: ContractRegistryRow[] = [];

    const includeReservations = !contractType || contractType === "reservation";
    const includeSales =
        !contractType || contractType === "cash_sale" || contractType === "payment_plan_sale";

    if (includeReservations && status !== "sold") {
        const reservationMatch: Record<string, unknown> = {
            company: companyId,
            status: {$ne: ReservationStatus.CONVERTED},
        };
        if (unitIds) reservationMatch.unit = {$in: unitIds};
        if (status) reservationMatch.status = status;

        const reservations = await Reservation.find(reservationMatch)
            .populate(CONTRACTS_HUB_RESERVATION_POPULATE)
            .lean();

        for (const doc of reservations) {
            const row = reservationToContractRow(doc as Record<string, unknown>);
            if (!inDateRange(doc.reservationDate, dateRange)) continue;
            if (
                !matchesSearch(search, [
                    row.contractNumber,
                    row.client?.name,
                    row.client?.surname,
                    row.unit?.name,
                    row.unit?.unitNumber,
                ])
            ) continue;
            rows.push(row);
        }
    }

    if (includeSales && (!status || status === "sold")) {
        const saleMatch: Record<string, unknown> = {
            company: companyId,
        };
        if (unitIds) saleMatch.unit = {$in: unitIds};
        if (contractType === "cash_sale") saleMatch.paymentType = SalePaymentType.CASH;
        if (contractType === "payment_plan_sale") saleMatch.paymentType = SalePaymentType.PAYMENT_PLAN;

        const sales = await Sale.find(saleMatch)
            .populate(CONTRACTS_HUB_SALE_POPULATE)
            .lean();

        for (const doc of sales) {
            const row = saleToContractRow(doc as Record<string, unknown>);
            if (!inDateRange(doc.saleDate, dateRange)) continue;
            if (
                !matchesSearch(search, [
                    row.contractNumber,
                    row.client?.name,
                    row.client?.surname,
                    row.unit?.name,
                    row.unit?.unitNumber,
                ])
            ) continue;
            rows.push(row);
        }
    }

    rows.sort((a, b) => {
        const aTime = a.signatureDate ? new Date(a.signatureDate).getTime() : 0;
        const bTime = b.signatureDate ? new Date(b.signatureDate).getTime() : 0;
        return bTime - aTime;
    });

    const paginated = paginateRows(rows, page, limit);
    logger.finish(`Contracts hub registry: ${paginated.total} rows`);
    return paginated;
}

async function listClients(
    params: HubParams & ClientsListFormType & any,
): Promise<ClientsListResponseType> {
    const {
        logger,
        company,
        search,
        projectId,
        unitTypeId,
        status,
        valueMin,
        valueMax,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing contracts hub clients...");

    const companyId = company._id;
    const unitIds = await resolveUnitIds({...params, projectId});

    const baseMatch: Record<string, unknown> = {
        company: companyId,
    };
    if (unitIds) baseMatch.unit = {$in: unitIds};

    const [sales, reservations] = await Promise.all([
        Sale.find(baseMatch).populate(CONTRACTS_HUB_SALE_POPULATE).lean(),
        Reservation.find({
            ...baseMatch,
            status: {$in: [ReservationStatus.ACTIVE, ReservationStatus.EXPIRED]},
        })
            .populate(CONTRACTS_HUB_RESERVATION_POPULATE)
            .lean(),
    ]);

    let rows = buildClientRegistryRows(
        sales as Record<string, unknown>[],
        reservations as Record<string, unknown>[],
    );

    if (unitTypeId && ObjectId.isValid(unitTypeId)) {
        const matchingUnitIds = new Set<string>();
        for (const sale of sales) {
            const unit = sale.unit as {unitType?: {_id?: {toString: () => string}}; _id?: {toString: () => string}} | undefined;
            if (unit?.unitType?._id?.toString?.() === unitTypeId && unit._id) {
                matchingUnitIds.add(unit._id.toString());
            }
        }
        for (const reservation of reservations) {
            const unit = reservation.unit as {unitType?: {_id?: {toString: () => string}}; _id?: {toString: () => string}} | undefined;
            if (unit?.unitType?._id?.toString?.() === unitTypeId && unit._id) {
                matchingUnitIds.add(unit._id.toString());
            }
        }
        rows = rows.filter((row) => matchingUnitIds.has(row.unitId));
    }

    if (status) {
        rows = rows.filter((row) => row.status === status);
    }

    if (valueMin != null) {
        rows = rows.filter((row) => (row.unitValue ?? 0) >= valueMin);
    }
    if (valueMax != null) {
        rows = rows.filter((row) => (row.unitValue ?? 0) <= valueMax);
    }

    if (search?.trim()) {
        rows = rows.filter((row) =>
            matchesSearch(search, [
                row.name,
                row.surname,
                row.email,
                row.phone,
                `${row.name ?? ""} ${row.surname ?? ""}`.trim(),
            ]),
        );
    }

    rows.sort((a, b) => {
        const aName = `${a.name ?? ""} ${a.surname ?? ""}`.trim().toLowerCase();
        const bName = `${b.name ?? ""} ${b.surname ?? ""}`.trim().toLowerCase();
        return aName.localeCompare(bName);
    });

    const paginated = paginateRows(rows, page, limit);
    logger.finish(`Contracts hub clients: ${paginated.total} rows`);
    return paginated;
}
