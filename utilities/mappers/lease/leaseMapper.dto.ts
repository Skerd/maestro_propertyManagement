import {ILease} from "../../../database/schemas/lease/lease";
import {Lease} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.dto";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapPopulatedSimpleCurrency, mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";

export function leaseToDTO(lease: ILease): Lease {
    const unit   = lease.unit as any;
    const tenant = lease.tenant as any;
    return {
        _id:  lease._id.toString(),
        name: lease.name,
        unit: unit ? {
            _id:        unit._id?.toString() ?? unit.toString(),
            name:       unit.name,
            unitNumber: unit.unitNumber,
        } : undefined,
        tenant:    tenant ? mapPopulatedSimpleUser(tenant) : undefined,
        startDate: lease.startDate ? new Date(lease.startDate).toISOString().split("T")[0] : "",
        endDate:   lease.endDate   ? new Date(lease.endDate).toISOString().split("T")[0]   : "",
        monthlyRent:  lease.monthlyRent  != null ? parseFloat(lease.monthlyRent.toString())  : 0,
        rentCurrency: mapPopulatedSimpleCurrency(lease.rentCurrency as any),
        depositAmount: lease.depositAmount != null ? parseFloat(lease.depositAmount.toString()) : undefined,
        depositPaid: lease.depositPaid,
        depositReturnedAt: lease.depositReturnedAt ? new Date(lease.depositReturnedAt).toISOString().split("T")[0] : undefined,
        status:            lease.status || undefined,
        terminationDate:   (lease as any).terminationDate ? new Date((lease as any).terminationDate).toISOString().split("T")[0] : undefined,
        terminationReason: lease.terminationReason,
        notes:             lease.notes,
        contractMedia:     lease.contractMedia ? mapMedia(lease.contractMedia) : undefined,
        ...mapSoftDeleteToDTO(lease),
        ...mapOwnershipToDTO(lease),
    };
}

export function leasesToDTO(leases: ILease[]): Lease[] {
    return leases.map(leaseToDTO);
}
