import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Lease, {ILease} from "./lease";
import type {FilterQuery} from "mongoose";
import type {ObjectId} from "mongodb";

export class LeaseService extends BaseCrudService<ILease, typeof Lease> {
    constructor() {
        super(Lease, "Lease");
    }

    /** Active leases of the given units with their rent currency, for the ROI report. */
    findForRoi(filter: FilterQuery<ILease>) {
        return this.model.find(filter).noDeleted()
            .select("unit monthlyRent rentCurrency")
            .populate("rentCurrency", "symbol decimalPlaces")
            .lean();
    }

    /** Tenant of each matching lease, for client audiences. */
    findTenantsLean(filter: FilterQuery<ILease>) {
        return this.model.find(filter).select("unit tenant").lean<{unit: ObjectId; tenant: ObjectId}[]>();
    }
}

export const leaseService = new LeaseService();
