import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Lease, {ILease} from "./lease";
import type {FilterQuery} from "mongoose";

export class LeaseService extends BaseCrudService<ILease, typeof Lease> {
    constructor() {
        super(Lease, "Lease");
    }

    /** Active leases of the given units with their rent currency, for the ROI report. */
    findForRoi(filter: FilterQuery<ILease>) {
        return this.model.find(filter).noDeleted()
            .select("unit monthlyRent rentCurrency")
            .populate("rentCurrency", "symbol")
            .lean();
    }
}

export const leaseService = new LeaseService();
