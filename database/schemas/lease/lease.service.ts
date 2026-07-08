import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Lease, {ILease} from "./lease";

export class LeaseService extends BaseCrudService<ILease, typeof Lease> {
    constructor() {
        super(Lease, "Lease");
    }
}

export const leaseService = new LeaseService();
