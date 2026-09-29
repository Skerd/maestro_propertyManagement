import type {LeaseRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.lease.dto";
import type {RentalPaymentRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.payment.dto";
import type {
    LeaseRegistryStatus,
    RentalPaymentRegistryStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.constants";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {LeaseSimple} from "armonia/src/modules/propertyManagement/dto/lease.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {LeaseSimpleSnippet} from "@propertyManagement/database/schemas/lease/lease.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {decimalToNumber, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {lateFeeNumber, remainingNumber, type RentMoneyRow} from "@propertyManagement/utilities/lease/rentRemaining";

const UNIT_POPULATE = [
    {
        path: "unit",
        populate: [
            {path: "project", select: "name"},
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

export const RENTALS_HUB_LEASE_POPULATE = [
    ...UNIT_POPULATE,
    {path: "tenant", select: "name surname email phoneNumber username"},
    {path: "rentCurrency", select: "name symbol abbreviation"},
];

export const RENTALS_HUB_PAYMENT_POPULATE = [
    ...UNIT_POPULATE,
    {path: "currency", select: "name symbol abbreviation"},
    {
        path: "lease",
        select: "name tenant status",
        populate: {path: "tenant", select: "name surname"},
    },
];

function projectFromUnit(unit: {project?: object; floor?: {edifice?: {project?: object}}} | null | undefined) {
    const project = unit?.project ?? unit?.floor?.edifice?.project;
    return mapSnippet<ProjectSimple>()(project as object | undefined, ProjectSimpleSnippet);
}

export function leaseToRegistryRow(
    doc: Record<string, unknown>,
    totals?: {collectedAmount?: number; outstandingAmount?: number},
): LeaseRegistryRow {
    const unit = doc.unit as {project?: object; floor?: {edifice?: {project?: object}}} | undefined;
    const tenant = mapSnippet<SimpleBlankUser>()(doc.tenant as object | undefined, SimpleBlankUserSnippet);
    return {
        _id: String(doc._id),
        name: doc.name as string | undefined,
        status: ((doc.status as string | undefined) ?? "active") as LeaseRegistryStatus,
        startDate: doc.startDate ? new Date(doc.startDate as Date | string).toISOString() : undefined,
        endDate: doc.endDate ? new Date(doc.endDate as Date | string).toISOString() : undefined,
        monthlyRent: decimalToNumber(doc.monthlyRent),
        collectedAmount: totals?.collectedAmount,
        outstandingAmount: totals?.outstandingAmount,
        currency: mapSnippet<CurrencySimple>()(doc.rentCurrency as object | undefined, CurrencySimpleSnippet),
        depositAmount: decimalToNumber(doc.depositAmount),
        depositPaid: !!doc.depositPaid,
        tenant: tenant
            ? {...tenant, email: (doc.tenant as {email?: string} | undefined)?.email}
            : undefined,
        unit: mapSnippet<UnitSimple>()(unit as object | undefined, UnitSimpleSnippet),
        project: projectFromUnit(unit),
        createdAt: doc.createdAt ? new Date(doc.createdAt as Date | string).toISOString() : undefined,
    };
}

export function rentalPaymentToRegistryRow(doc: Record<string, unknown>): RentalPaymentRegistryRow {
    const unit = doc.unit as {project?: object; floor?: {edifice?: {project?: object}}} | undefined;
    const lease = doc.lease as {tenant?: object} | undefined;
    const tenant = lease?.tenant
        ? mapSnippet<SimpleBlankUser>()(lease.tenant, SimpleBlankUserSnippet)
        : undefined;
    const money = doc as RentMoneyRow;
    return {
        _id: String(doc._id),
        name: doc.name as string | undefined,
        status: ((doc.status as string | undefined) ?? "pending") as RentalPaymentRegistryStatus,
        dueDate: doc.dueDate ? new Date(doc.dueDate as Date | string).toISOString() : undefined,
        amount: decimalToNumber(doc.amount),
        paidAmount: decimalToNumber(doc.paidAmount),
        remaining: remainingNumber(money),
        lateFeeAmount: lateFeeNumber(money),
        paidDate: doc.paidDate ? new Date(doc.paidDate as Date | string).toISOString() : undefined,
        currency: mapSnippet<CurrencySimple>()(doc.currency as object | undefined, CurrencySimpleSnippet),
        lease: mapSnippet<LeaseSimple>()(lease as object | undefined, LeaseSimpleSnippet),
        tenant: tenant ?? undefined,
        unit: mapSnippet<UnitSimple>()(unit as object | undefined, UnitSimpleSnippet),
        project: projectFromUnit(unit),
        createdAt: doc.createdAt ? new Date(doc.createdAt as Date | string).toISOString() : undefined,
    };
}
