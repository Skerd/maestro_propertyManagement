import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Commission, {ICommission} from "./commission";

export class CommissionService extends BaseCrudService<ICommission, typeof Commission> {
    constructor() {
        super(Commission, "Commission");
    }
}

export const commissionService = new CommissionService();
