import type {ClientRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.client.dto";
import type {ContractRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.contract.dto";
import type {
    ClientRegistryStatus,
    ContractPaymentStatus,
    ContractRegistryStatus,
    ContractRegistryType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractsHub/contractsHub.constants";
import {SalePaymentType} from "../../database/schemas/sale/sale";
import {ReservationStatus} from "../../database/schemas/reservation/reservation";
import {computePaymentPlanPaid, computePaymentPlanRemainingBalance} from "../../database/schemas/paymentPlan/paymentPlan";
import {DEFAULT_DECIMAL_PLACES, type MoneyInput, roundToCurrency, subtractMoney, toMinor} from "armonia/src/modules/core/helpers/money";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {decimalToNumber, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";

const UNIT_POPULATE = [
    {
        path: "unit",
        populate: [
            {path: "unitType", select: "name icon"},
            {path: "priceCurrency", select: "name symbol abbreviation decimalPlaces"},
            {
                path: "floor",
                populate: {
                    path: "edifice",
                    populate: {path: "project", select: "name"},
                },
            },
        ],
    },
];

export const CONTRACTS_HUB_UNIT_POPULATE = UNIT_POPULATE;

export const CONTRACTS_HUB_RESERVATION_POPULATE = [
    ...UNIT_POPULATE,
    {path: "client", select: "name surname phoneNumber username"},
    {path: "reservedBy", select: "name surname"},
    {path: "reservationContract", select: "fileName metadata createdAt"},
];

export const CONTRACTS_HUB_SALE_POPULATE = [
    ...UNIT_POPULATE,
    {path: "buyer", select: "name surname phoneNumber username"},
    {path: "soldBy", select: "name surname"},
    {path: "purchaseContract", select: "fileName metadata createdAt"},
    {path: "saleCurrency", select: "name symbol abbreviation decimalPlaces"},
    {
        path: "paymentPlan",
        select: "totalAmount downPayment downPaymentPaid remainingBalance installments status",
    },
    {path: "reservation", select: "name reservationDate"},
];

/** A stored local day (`YYYY-MM-DD`, D115), or undefined. */
function dayOf(value: unknown): string | undefined {
    return typeof value === "string" && value !== "" ? value : undefined;
}

function mediaUploadDate(media: unknown): string | undefined {
    if (!media) return undefined;
    const m = media as {createdAt?: Date};
    return m.createdAt ? new Date(m.createdAt).toISOString() : undefined;
}

function mapUserContact(user: unknown): Pick<ClientRegistryRow, "name" | "surname" | "phone" | "email"> {
    if (!user) return {};
    const u = user as {
        name?: string;
        surname?: string;
        phoneNumber?: string;
        username?: string;
    };
    return {
        name: u.name,
        surname: u.surname,
        phone: u.phoneNumber,
        email: u.username,
    };
}

function mapUnitLocation(unit: unknown): Pick<ContractRegistryRow, "project" | "unit"> {
    if (!unit || typeof unit !== "object") return {};
    const u = unit as {floor?: {edifice?: {project?: object}}};
    return {
        unit: mapSnippet<UnitSimple>()(unit, UnitSimpleSnippet),
        project: u.floor?.edifice?.project
            ? mapSnippet<ProjectSimple>()(u.floor.edifice.project, ProjectSimpleSnippet)
            : undefined,
    };
}

function reservationPaymentStatus(reservation: {
    paid?: boolean;
    depositAmount?: MoneyInput;
}): ContractPaymentStatus {
    if (reservation.paid === true) return "ok";
    if (toMinor(reservation.depositAmount) > 0n) return "partially";
    return "no_payments";
}

function salePaymentStatus(sale: {
    paymentType?: string;
    paymentPlan?: unknown;
}): ContractPaymentStatus {
    if (sale.paymentType === SalePaymentType.CASH) return "ok";
    const plan = sale.paymentPlan as {
        totalAmount?: MoneyInput;
        downPayment?: MoneyInput;
        downPaymentPaid?: boolean;
        installments?: Array<{amount?: MoneyInput; paidAmount?: MoneyInput; status?: string}>;
    } | null;
    if (!plan) return "no_payments";

    const remaining = computePaymentPlanRemainingBalance(plan);
    if (remaining <= 0) return "ok";

    const installmentPaid = (plan.installments ?? []).some((inst) => toMinor(inst.paidAmount) > 0n);

    if (plan.downPaymentPaid || installmentPaid || toMinor(plan.downPayment) > 0n) return "partially";
    return "no_payments";
}

function reservationContractType(): ContractRegistryType {
    return "reservation";
}

function saleContractType(paymentType?: string): ContractRegistryType {
    return paymentType === SalePaymentType.PAYMENT_PLAN ? "payment_plan_sale" : "cash_sale";
}

function reservationContractStatus(status?: string): ContractRegistryStatus {
    if (status === ReservationStatus.CANCELLED) return "cancelled";
    if (status === ReservationStatus.EXPIRED) return "expired";
    return "active";
}

export function reservationToContractRow(reservation: Record<string, unknown>): ContractRegistryRow {
    const id = String((reservation._id as {_id?: unknown})?.toString?.() ?? reservation._id);
    const unit = reservation.unit;
    const location = mapUnitLocation(unit);
    const contracts = reservation.reservationContract as unknown[] | undefined;

    return {
        _id: `reservation:${id}`,
        sourceType: "reservation",
        sourceId: id,
        contractNumber: reservation.name as string | undefined,
        client: mapSnippet<SimpleBlankUser>()(reservation.client as object | undefined, SimpleBlankUserSnippet),
        ...location,
        contractType: reservationContractType(),
        status: reservationContractStatus(reservation.status as string | undefined),
        signatureDate: dayOf(reservation.reservationDate),
        uploadDate: mediaUploadDate(contracts?.[0]),
        agent: mapSnippet<SimpleBlankUser>()(reservation.reservedBy as object | undefined, SimpleBlankUserSnippet),
        paymentStatus: reservationPaymentStatus(reservation as {paid?: boolean; depositAmount?: unknown}),
    };
}

export function saleToContractRow(sale: Record<string, unknown>): ContractRegistryRow {
    const id = String((sale._id as {_id?: unknown})?.toString?.() ?? sale._id);
    const location = mapUnitLocation(sale.unit);

    return {
        _id: `sale:${id}`,
        sourceType: "sale",
        sourceId: id,
        contractNumber: sale.name as string | undefined,
        client: mapSnippet<SimpleBlankUser>()(sale.buyer as object | undefined, SimpleBlankUserSnippet),
        ...location,
        contractType: saleContractType(sale.paymentType as string | undefined),
        status: "sold",
        signatureDate: dayOf(sale.saleDate),
        uploadDate: mediaUploadDate(sale.purchaseContract),
        agent: mapSnippet<SimpleBlankUser>()(sale.soldBy as object | undefined, SimpleBlankUserSnippet),
        paymentStatus: salePaymentStatus(sale as {paymentType?: string; paymentPlan?: unknown}),
    };
}

function computeClientMoney(
    status: ClientRegistryStatus,
    sale: Record<string, unknown> | undefined,
    reservation: Record<string, unknown> | undefined,
): {paid?: number; remaining?: number; unitValue?: number; currency?: ClientRegistryRow["currency"]} {
    if (status === "sold" && sale) {
        const finalPrice = decimalToNumber(sale.finalPrice as never);
        const currency = mapSnippet<CurrencySimple>()(sale.saleCurrency as object | undefined, CurrencySimpleSnippet);
        const paymentType = sale.paymentType as string | undefined;

        if (paymentType === SalePaymentType.CASH) {
            return {paid: finalPrice, remaining: 0, unitValue: finalPrice, currency};
        }

        const plan = sale.paymentPlan as {
            totalAmount?: MoneyInput;
            downPayment?: MoneyInput;
            downPaymentPaid?: boolean;
            installments?: Array<{amount?: MoneyInput; paidAmount?: MoneyInput; status?: string}>;
        } | null;

        if (plan) {
            const totalAmount = decimalToNumber(plan.totalAmount as never) ?? finalPrice ?? 0;
            // What was paid, read from the payments: total − remaining would drop the contract interest (TD-B134).
            return {
                paid: computePaymentPlanPaid(plan),
                remaining: computePaymentPlanRemainingBalance(plan),
                unitValue: finalPrice ?? totalAmount,
                currency,
            };
        }

        return {paid: 0, remaining: finalPrice, unitValue: finalPrice, currency};
    }

    if (reservation) {
        const unit = reservation.unit as {price?: MoneyInput; priceCurrency?: unknown} | undefined;
        const currency = mapSnippet<CurrencySimple>()(unit?.priceCurrency as object | undefined, CurrencySimpleSnippet);
        const decimals = currency?.decimalPlaces ?? DEFAULT_DECIMAL_PLACES;
        const unitPrice = unit?.price != null ? roundToCurrency(unit.price, decimals) : undefined;
        // D127: a reservation's paid is its deposit once paid, else nothing; what remains is the price less that.
        if (reservation.paid !== true) {
            return {paid: 0, remaining: unitPrice, unitValue: unitPrice, currency};
        }
        // A deposit in another currency than the price is never subtracted from it (GLB-08): no paid / remaining then.
        const depositCurrency = reservation.depositCurrency != null ? String(reservation.depositCurrency) : undefined;
        if (depositCurrency && currency && depositCurrency !== currency._id) {
            return {unitValue: unitPrice, currency};
        }
        const deposit = roundToCurrency(reservation.depositAmount as MoneyInput, decimals);
        return {
            paid: deposit,
            remaining: unitPrice != null ? Math.max(0, subtractMoney(unitPrice, deposit, decimals)) : undefined,
            unitValue: unitPrice,
            currency,
        };
    }

    return {};
}

export function buildClientRegistryRows(
    sales: Record<string, unknown>[],
    reservations: Record<string, unknown>[],
): ClientRegistryRow[] {
    const rowMap = new Map<string, ClientRegistryRow>();

    for (const reservation of reservations) {
        const client = reservation.client as {_id?: {toString: () => string}} | undefined;
        const unit = reservation.unit as {_id?: {toString: () => string}} | undefined;
        if (!client?._id || !unit?._id) continue;

        const clientId = client._id.toString();
        const unitId = unit._id.toString();
        const key = `${clientId}:${unitId}`;
        const contact = mapUserContact(reservation.client);
        const location = mapUnitLocation(reservation.unit);
        const unitDoc = reservation.unit as {
            unitType?: {name?: string};
            netArea?: number;
            area?: number;
        };
        const money = computeClientMoney("reserved", undefined, reservation);

        rowMap.set(key, {
            _id: key,
            clientId,
            unitId,
            ...contact,
            ...location,
            typology: unitDoc.unitType?.name,
            surface: unitDoc.netArea ?? unitDoc.area,
            unitValue: money.unitValue,
            currency: money.currency,
            status: "reserved",
            bookingDate: dayOf(reservation.reservationDate),
            agent: mapSnippet<SimpleBlankUser>()(reservation.reservedBy as object | undefined, SimpleBlankUserSnippet),
            paid: money.paid,
            remaining: money.remaining,
            sourceType: "reservation",
            sourceId: String(reservation._id),
        });
    }

    for (const sale of sales) {
        const buyer = sale.buyer as {_id?: {toString: () => string}} | undefined;
        const unit = sale.unit as {_id?: {toString: () => string}} | undefined;
        if (!buyer?._id || !unit?._id) continue;

        const clientId = buyer._id.toString();
        const unitId = unit._id.toString();
        const key = `${clientId}:${unitId}`;
        const contact = mapUserContact(sale.buyer);
        const location = mapUnitLocation(sale.unit);
        const unitDoc = sale.unit as {
            unitType?: {name?: string};
            netArea?: number;
            area?: number;
        };
        const linkedReservation = sale.reservation as {reservationDate?: string} | undefined;
        const money = computeClientMoney("sold", sale, undefined);
        const existing = rowMap.get(key);

        rowMap.set(key, {
            _id: key,
            clientId,
            unitId,
            ...contact,
            ...location,
            typology: unitDoc.unitType?.name,
            surface: unitDoc.netArea ?? unitDoc.area,
            unitValue: money.unitValue,
            currency: money.currency,
            status: "sold",
            bookingDate: existing?.bookingDate ?? (linkedReservation?.reservationDate || undefined),
            contractDate: dayOf(sale.saleDate),
            agent: mapSnippet<SimpleBlankUser>()(sale.soldBy as object | undefined, SimpleBlankUserSnippet),
            paid: money.paid,
            remaining: money.remaining,
            sourceType: "sale",
            sourceId: String(sale._id),
        });
    }

    return [...rowMap.values()];
}

export function matchesSearch(
    search: string | undefined,
    parts: Array<string | undefined | null>,
): boolean {
    if (!search?.trim()) return true;
    const needle = search.trim().toLowerCase();
    return parts.some((part) => part?.toLowerCase().includes(needle));
}

export function paginateRows<T>(rows: T[], page = 1, limit = 10): {data: T[]; total: number; page: number; limit: number} {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const total = rows.length;
    const start = (safePage - 1) * safeLimit;
    return {
        data: rows.slice(start, start + safeLimit),
        total,
        page: safePage,
        limit: safeLimit,
    };
}
