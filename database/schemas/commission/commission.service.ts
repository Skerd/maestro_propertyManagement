import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Commission, {ICommission} from "./commission";
import type {FilterQuery} from "mongoose";

export class CommissionService extends BaseCrudService<ICommission, typeof Commission> {
    constructor() {
        super(Commission, "Commission");
    }

    /** Commissions with their agent, currency and sale, for the ERP export. */
    findForErpExport(filter: FilterQuery<ICommission>) {
        return this.model.find(filter)
            .select("agent amount currency status sale createdAt")
            .populate("agent", "name surname")
            .populate("currency", "abbreviation symbol")
            .populate("sale", "name")
            .lean();
    }
}

export const commissionService = new CommissionService();
