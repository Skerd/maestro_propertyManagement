import type {LeaseRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.lease.dto";
import type {RentalPaymentRegistryRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.payment.dto";
import type {
    LeaseRegistryStatus,
    RentalPaymentRegistryStatus,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalsHub/rentalsHub.constants";
import {
    decimalToNumber,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser,
} from "@coreModule/utilities/mappers/common.mapper";

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
        select: "name tenant",
        populate: {path: "tenant", select: "name surname"},
    },
];

function projectFromUnit(unit: any): {_id: string; name?: string} | undefined {
    const project = unit?.project ?? unit?.floor?.edifice?.project;
    if (!project) return undefined;
    return {
        _id: (project._id ?? project).toString(),
        name: project.name,
    };
}

function mapUnit(unit: any): LeaseRegistryRow["unit"] {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() ?? String(unit),
        name: unit.name,
        unitNumber: unit.unitNumber,
    };
}

export function leaseToRegistryRow(doc: Record<string, any>): LeaseRegistryRow {
    const unit = doc.unit as any;
    const tenant = mapPopulatedSimpleUser(doc.tenant);
    return {
        _id: doc._id.toString(),
        name: doc.name,
        status: (doc.status ?? "active") as LeaseRegistryStatus,
        startDate: doc.startDate ? new Date(doc.startDate).toISOString() : undefined,
        endDate: doc.endDate ? new Date(doc.endDate).toISOString() : undefined,
        monthlyRent: decimalToNumber(doc.monthlyRent),
        currency: mapPopulatedSimpleCurrency(doc.rentCurrency),
        depositAmount: decimalToNumber(doc.depositAmount),
        depositPaid: !!doc.depositPaid,
        tenant: tenant
            ? {_id: tenant._id, name: tenant.name, surname: tenant.surname, email: (doc.tenant as any)?.email}
            : undefined,
        unit: mapUnit(unit),
        project: projectFromUnit(unit),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    };
}

export function rentalPaymentToRegistryRow(doc: Record<string, any>): RentalPaymentRegistryRow {
    const unit = doc.unit as any;
    const lease = doc.lease as any;
    const tenant = lease?.tenant ? mapPopulatedSimpleUser(lease.tenant) : undefined;
    return {
        _id: doc._id.toString(),
        name: doc.name,
        status: (doc.status ?? "pending") as RentalPaymentRegistryStatus,
        dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString() : undefined,
        amount: decimalToNumber(doc.amount),
        paidAmount: decimalToNumber(doc.paidAmount),
        paidDate: doc.paidDate ? new Date(doc.paidDate).toISOString() : undefined,
        currency: mapPopulatedSimpleCurrency(doc.currency),
        lease: lease
            ? {_id: (lease._id ?? lease).toString(), name: lease.name}
            : undefined,
        tenant: tenant
            ? {_id: tenant._id, name: tenant.name, surname: tenant.surname}
            : undefined,
        unit: mapUnit(unit),
        project: projectFromUnit(unit),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    };
}
