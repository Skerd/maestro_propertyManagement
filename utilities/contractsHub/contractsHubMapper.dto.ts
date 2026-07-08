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
import {computePaymentPlanRemainingBalance} from "../../database/schemas/paymentPlan/paymentPlan";
import {
    decimalToNumber,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser,
} from "@coreModule/utilities/mappers/common.mapper";

const UNIT_POPULATE = [
    {
        path: "unit",
        populate: [
            {path: "unitType", select: "name icon"},
            {path: "priceCurrency", select: "name symbol abbreviation"},
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
    {path: "saleCurrency", select: "name symbol abbreviation"},
    {
        path: "paymentPlan",
        select: "totalAmount downPayment downPaymentPaid remainingBalance installments status",
    },
    {path: "reservation", select: "name reservationDate"},
];

function toIsoDate(value: unknown): string | undefined {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function mediaUploadDate(media: unknown): string | undefined {
    if (!media) return undefined;
    const m = media as {createdAt?: Date};
    return m.createdAt ? new Date(m.createdAt).toISOString() : undefined;
}

function mapUserRef(user: unknown): {_id: string; name?: string; surname?: string} | undefined {
    if (!user) return undefined;
    const u = user as {_id?: {toString: () => string}; name?: string; surname?: string};
    return {
        _id: u._id?.toString?.() ?? String(user),
        name: u.name,
        surname: u.surname,
    };
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
    const u = unit as {
        _id?: {toString: () => string};
        name?: string;
        unitNumber?: string;
        floor?: {edifice?: {project?: unknown; name?: string; _id?: unknown}; name?: string; _id?: unknown};
    };
    if (!u) return {};
    return {
        unit: {
            _id: u._id?.toString?.() ?? "",
            name: u.name,
            unitNumber: u.unitNumber,
        },
        project: mapPopulatedRef(u.floor?.edifice?.project),
    };
}

function reservationPaymentStatus(reservation: {
    paid?: boolean;
    depositAmount?: unknown;
}): ContractPaymentStatus {
    const paid = reservation.paid === true;
    const deposit =
        reservation.depositAmount != null
            ? parseFloat(String(reservation.depositAmount))
            : 0;
    if (paid) return "ok";
    if (deposit > 0) return "partially";
    return "no_payments";
}

function salePaymentStatus(sale: {
    paymentType?: string;
    paymentPlan?: unknown;
}): ContractPaymentStatus {
    if (sale.paymentType === SalePaymentType.CASH) return "ok";
    const plan = sale.paymentPlan as {
        totalAmount?: unknown;
        downPayment?: unknown;
        downPaymentPaid?: boolean;
        installments?: Array<{paidAmount?: unknown}>;
    } | null;
    if (!plan) return "no_payments";

    const remaining = computePaymentPlanRemainingBalance(plan);
    if (remaining <= 0) return "ok";

    const downPayment =
        plan.downPayment != null ? parseFloat(String(plan.downPayment)) : 0;
    const installmentPaid = (plan.installments ?? []).some((inst) => {
        const raw = inst.paidAmount;
        const paid = raw != null ? parseFloat(String(raw)) : 0;
        return paid > 0;
    });

    if (plan.downPaymentPaid || installmentPaid || downPayment > 0) return "partially";
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
        client: mapUserRef(reservation.client),
        ...location,
        contractType: reservationContractType(),
        status: reservationContractStatus(reservation.status as string | undefined),
        signatureDate: toIsoDate(reservation.reservationDate),
        uploadDate: mediaUploadDate(contracts?.[0]),
        agent: mapUserRef(reservation.reservedBy),
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
        client: mapUserRef(sale.buyer),
        ...location,
        contractType: saleContractType(sale.paymentType as string | undefined),
        status: "sold",
        signatureDate: toIsoDate(sale.saleDate),
        uploadDate: mediaUploadDate(sale.purchaseContract),
        agent: mapUserRef(sale.soldBy),
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
        const currency = mapPopulatedSimpleCurrency(sale.saleCurrency as never);
        const paymentType = sale.paymentType as string | undefined;

        if (paymentType === SalePaymentType.CASH) {
            return {paid: finalPrice, remaining: 0, unitValue: finalPrice, currency};
        }

        const plan = sale.paymentPlan as {
            totalAmount?: unknown;
            downPayment?: unknown;
            downPaymentPaid?: boolean;
            installments?: Array<{paidAmount?: unknown}>;
        } | null;

        if (plan) {
            const totalAmount = decimalToNumber(plan.totalAmount as never) ?? finalPrice ?? 0;
            const remaining = computePaymentPlanRemainingBalance(plan);
            return {
                paid: Math.max(0, totalAmount - remaining),
                remaining,
                unitValue: finalPrice ?? totalAmount,
                currency,
            };
        }

        return {paid: 0, remaining: finalPrice, unitValue: finalPrice, currency};
    }

    if (reservation) {
        const unit = reservation.unit as {price?: unknown; priceCurrency?: unknown} | undefined;
        const unitPrice = unit?.price != null ? parseFloat(String(unit.price)) : undefined;
        const deposit =
            reservation.depositAmount != null
                ? parseFloat(String(reservation.depositAmount))
                : 0;
        const paid = reservation.paid === true;
        const currency = mapPopulatedSimpleCurrency(unit?.priceCurrency as never);

        let remaining: number | undefined;
        if (unitPrice != null && Number.isFinite(unitPrice)) {
            remaining = paid ? 0 : Math.max(0, unitPrice - deposit);
        }

        return {
            paid: paid ? unitPrice ?? deposit : deposit,
            remaining,
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
            bookingDate: toIsoDate(reservation.reservationDate),
            agent: mapUserRef(reservation.reservedBy),
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
        const linkedReservation = sale.reservation as {reservationDate?: unknown} | undefined;
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
            bookingDate: existing?.bookingDate ?? toIsoDate(linkedReservation?.reservationDate),
            contractDate: toIsoDate(sale.saleDate),
            agent: mapUserRef(sale.soldBy),
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
