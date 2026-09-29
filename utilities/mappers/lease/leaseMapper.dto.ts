import {ILease} from "../../../database/schemas/lease/lease";
import {Lease} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";

export function leaseToDTO(lease: ILease): Lease {
    const tenant = mapSnippet<SimpleBlankUser>()(lease.tenant as object | undefined, SimpleBlankUserSnippet);
    return {
        _id:  lease._id.toString(),
        name: lease.name,
        unit: mapSnippet<UnitSimple>()(lease.unit as object | undefined, UnitSimpleSnippet),
        tenant: tenant
            ? {
                ...tenant,
                email: (lease.tenant as {email?: string} | undefined)?.email,
            }
            : undefined,
        startDate: lease.startDate ? new Date(lease.startDate).toISOString().split("T")[0] : "",
        endDate:   lease.endDate   ? new Date(lease.endDate).toISOString().split("T")[0]   : "",
        monthlyRent:  lease.monthlyRent  != null ? parseFloat(lease.monthlyRent.toString())  : 0,
        rentCurrency: mapSnippet<CurrencySimple>()(lease.rentCurrency as object | undefined, CurrencySimpleSnippet),
        depositAmount: lease.depositAmount != null ? parseFloat(lease.depositAmount.toString()) : undefined,
        lateFeePercentage: lease.lateFeePercentage,
        gracePeriodDays: lease.gracePeriodDays,
        depositPaid: lease.depositPaid,
        depositReturnedAt: lease.depositReturnedAt ? new Date(lease.depositReturnedAt).toISOString().split("T")[0] : undefined,
        status:            lease.status || undefined,
        terminationDate:   lease.terminationDate ? new Date(lease.terminationDate).toISOString().split("T")[0] : undefined,
        terminationReason: lease.terminationReason,
        notes:             lease.notes,
        contractMedia:     lease.contractMedia ? mapMedia(lease.contractMedia) : undefined,
        ...mapSoftDeleteToDTO(lease),
        ...mapOwnershipToDTO(lease),
        ...mapLifeCycleToDTO(lease),
    };
}

export function leasesToDTO(leases: ILease[]): Lease[] {
    return leases.map(leaseToDTO);
}
