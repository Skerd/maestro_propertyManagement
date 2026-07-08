import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {ILease} from "../../../database/schemas/lease/lease";

export function leaseToSelect(lease: ILease): ApiSelectDatum {
    const unit = lease.unit as any;
    const label = lease.name ?? (unit?.name ?? unit?._id?.toString() ?? lease._id.toString());
    return {
        value: lease._id.toString(),
        label,
    };
}

export function leasesToSelect(leases: ILease[]): ApiSelectDatum[] {
    return leases.map(leaseToSelect);
}
