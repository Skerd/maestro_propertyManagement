import {Router} from "express";
import {inDayRange, parseDayRange} from "../../../utilities/hubShared/dayRange";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {SalePaymentType} from "../../../database/schemas/sale/sale";
import {ReservationStatus} from "../../../database/schemas/reservation/reservation";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {
    clientsListFormSchema,
    contractsListFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.form.validator";
import type {ClientsListFormType, ContractsListFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.form.type";
import type {ClientsListResponseType, ContractsListResponseType} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.response.type";
import type {ContractRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.contract.dto";
import type {ClientRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.client.dto";
import {
    buildClientRegistryRows,
    CONTRACTS_HUB_RESERVATION_POPULATE,
    CONTRACTS_HUB_SALE_POPULATE,
    matchesSearch,
    paginateRows,
    reservationToContractRow,
    saleToContractRow,
} from "../../../utilities/contractsHub/contractsHubMapper.dto";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
    collectedFieldReader,
    omitRowKeys,
    type RowFieldSources,
    unreadableRowKeys,
} from "@propertyManagement/utilities/security/canReadCollectedFields";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";

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

const RES = "reservations";
const SALE = "sales";
const UNIT = "units";
const PLAN = "paymentplans";

/** Field-level read (SEC-09): where each contract row field comes from, per source record. */
const RESERVATION_CONTRACT_SOURCES: RowFieldSources<ContractRegistryRow> = {
    contractNumber: [[RES, "name"]],
    status: [[RES, "status"]],
    paymentStatus: [[RES, "paid"], [RES, "depositAmount"]],
    client: [[RES, "client"]],
    unit: [[RES, "unit"]],
    project: [[RES, "unit"]],
    signatureDate: [[RES, "reservationDate"]],
    uploadDate: [[RES, "reservationContract"]],
    agent: [[RES, "reservedBy"]],
};

const SALE_CONTRACT_SOURCES: RowFieldSources<ContractRegistryRow> = {
    contractNumber: [[SALE, "name"]],
    contractType: [[SALE, "paymentType"]],
    paymentStatus: [[SALE, "paymentType"], [SALE, "paymentPlan"], [PLAN, "downPayment"], [PLAN, "downPaymentPaid"], [PLAN, "installments"]],
    client: [[SALE, "buyer"]],
    unit: [[SALE, "unit"]],
    project: [[SALE, "unit"]],
    signatureDate: [[SALE, "saleDate"]],
    uploadDate: [[SALE, "purchaseContract"]],
    agent: [[SALE, "soldBy"]],
};

/** Field-level read (SEC-09): where each client row field comes from, per source record. */
const RESERVATION_CLIENT_SOURCES: RowFieldSources<ClientRegistryRow> = {
    name: [[RES, "client"]],
    surname: [[RES, "client"]],
    phone: [[RES, "client"]],
    email: [[RES, "client"]],
    unit: [[RES, "unit"]],
    project: [[RES, "unit"]],
    typology: [[RES, "unit"], [UNIT, "unitType"]],
    surface: [[RES, "unit"], [UNIT, "netArea"], [UNIT, "area"]],
    unitValue: [[RES, "unit"], [UNIT, "price"]],
    currency: [[RES, "unit"], [UNIT, "priceCurrency"]],
    paid: [[RES, "unit"], [UNIT, "price"], [UNIT, "priceCurrency"], [RES, "depositAmount"], [RES, "depositCurrency"], [RES, "paid"]],
    remaining: [[RES, "unit"], [UNIT, "price"], [UNIT, "priceCurrency"], [RES, "depositAmount"], [RES, "depositCurrency"], [RES, "paid"]],
    bookingDate: [[RES, "reservationDate"]],
    agent: [[RES, "reservedBy"]],
};

const SALE_MONEY: readonly (readonly [string, string])[] = [
    [SALE, "finalPrice"],
    [SALE, "paymentType"],
    [SALE, "paymentPlan"],
    [PLAN, "totalAmount"],
    [PLAN, "downPayment"],
    [PLAN, "downPaymentPaid"],
    [PLAN, "installments"],
];

const SALE_CLIENT_SOURCES: RowFieldSources<ClientRegistryRow> = {
    name: [[SALE, "buyer"]],
    surname: [[SALE, "buyer"]],
    phone: [[SALE, "buyer"]],
    email: [[SALE, "buyer"]],
    unit: [[SALE, "unit"]],
    project: [[SALE, "unit"]],
    typology: [[SALE, "unit"], [UNIT, "unitType"]],
    surface: [[SALE, "unit"], [UNIT, "netArea"], [UNIT, "area"]],
    unitValue: [[SALE, "finalPrice"]],
    currency: [[SALE, "saleCurrency"]],
    paid: SALE_MONEY,
    remaining: SALE_MONEY,
    bookingDate: [[SALE, "reservation"], [RES, "reservationDate"]],
    contractDate: [[SALE, "saleDate"]],
    agent: [[SALE, "soldBy"]],
};

async function resolveUnitIds(
    params: HubParams & {
        project?: string;
        edifice?: string;
        floor?: string;
        unit?: string;
    },
): Promise<ObjectId[] | undefined> {
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

async function listContracts(
    params: HubParams & ContractsListFormType,
): Promise<ContractsListResponseType> {
    const {
        logger,
        languageCode,
        actionUserCtx,
        company,
        search,
        project,
        edifice,
        floor,
        unit,
        contractType,
        status,
        signatureDateFrom,
        signatureDateTo,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing contracts hub registry...");
    const canReadSales = canReadCollectedFields("sales", actionUserCtx, languageCode);
    const canReadReservations = canReadCollectedFields("reservations", actionUserCtx, languageCode);
    assertAnyCollectedRead(canReadSales || canReadReservations, languageCode);

    const companyId = company._id;
    const unitIds = await resolveUnitIds({...params, project, edifice, floor, unit});
    const dateRange = parseDayRange(signatureDateFrom, signatureDateTo);
    const rows: ContractRegistryRow[] = [];
    const read = collectedFieldReader(actionUserCtx, languageCode);

    const includeReservations = !contractType || contractType === "reservation";
    const includeSales =
        !contractType || contractType === "cash_sale" || contractType === "payment_plan_sale";

    if (canReadReservations && includeReservations && status !== "sold") {
        const reservationMatch: Record<string, unknown> = {
            company: companyId,
            status: {$ne: ReservationStatus.CONVERTED},
        };
        if (unitIds) reservationMatch.unit = {$in: unitIds};
        // A status the caller may not read is no filter (SEC-09), like the hidden date filter below.
        if (status && read(RES, "status")) reservationMatch.status = status;

        const reservations = await reservationService.findForContractsHub(reservationMatch);

        const hidden = unreadableRowKeys(RESERVATION_CONTRACT_SOURCES, read);
        const canFilterByDate = read(RES, "reservationDate");
        for (const doc of reservations) {
            const row = omitRowKeys(reservationToContractRow(doc as Record<string, unknown>), hidden);
            if (canFilterByDate && !inDayRange(doc.reservationDate, dateRange)) continue;
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

    if (canReadSales && includeSales && (!status || status === "sold")) {
        const saleMatch: Record<string, unknown> = {
            company: companyId,
        };
        if (unitIds) saleMatch.unit = {$in: unitIds};
        // A sale's type is its payment type: a caller who may not read that gets no type filter (SEC-09).
        if (read(SALE, "paymentType")) {
            if (contractType === "cash_sale") saleMatch.paymentType = SalePaymentType.CASH;
            if (contractType === "payment_plan_sale") saleMatch.paymentType = SalePaymentType.PAYMENT_PLAN;
        }

        const sales = await saleService.findForContractsHub(saleMatch);

        const hidden = unreadableRowKeys(SALE_CONTRACT_SOURCES, read);
        const canFilterByDate = read(SALE, "saleDate");
        for (const doc of sales) {
            const row = omitRowKeys(saleToContractRow(doc as Record<string, unknown>), hidden);
            if (canFilterByDate && !inDayRange(doc.saleDate, dateRange)) continue;
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
        return (b.signatureDate ?? "").localeCompare(a.signatureDate ?? "");
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
        languageCode,
        actionUserCtx,
        company,
        search,
        project,
        edifice,
        floor,
        unit,
        unitTypeId,
        status,
        valueMin,
        valueMax,
        page = 1,
        limit = 10,
    } = params;

    logger.start("Listing contracts hub clients...");
    const canReadSales = canReadCollectedFields("sales", actionUserCtx, languageCode);
    const canReadReservations = canReadCollectedFields("reservations", actionUserCtx, languageCode);
    assertAnyCollectedRead(canReadSales || canReadReservations, languageCode);

    const companyId = company._id;
    const unitIds = await resolveUnitIds({...params, project, edifice, floor, unit});

    const baseMatch: Record<string, unknown> = {
        company: companyId,
    };
    if (unitIds) baseMatch.unit = {$in: unitIds};

    const [sales, reservations] = await Promise.all([
        canReadSales
            ? saleService.findForContractsHub(baseMatch)
            : Promise.resolve([]),
        canReadReservations
            ? reservationService.findForContractsHub({
                ...baseMatch,
                status: {$in: [ReservationStatus.ACTIVE, ReservationStatus.EXPIRED]},
            })
            : Promise.resolve([]),
    ]);

    // Masked before the value filters and search below, so hidden contacts and amounts cannot be probed.
    const read = collectedFieldReader(actionUserCtx, languageCode);
    const hiddenOnReservation = unreadableRowKeys(RESERVATION_CLIENT_SOURCES, read);
    const hiddenOnSale = unreadableRowKeys(SALE_CLIENT_SOURCES, read);
    let rows = buildClientRegistryRows(
        sales as Record<string, unknown>[],
        reservations as Record<string, unknown>[],
    ).map((row) => omitRowKeys(row, row.sourceType === "sale" ? hiddenOnSale : hiddenOnReservation));

    if (unitTypeId && ObjectId.isValid(unitTypeId) && read(UNIT, "unitType")) {
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
