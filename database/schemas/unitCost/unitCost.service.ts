import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import UnitCost, {IUnitCost} from "./unitCost";
import type {FilterQuery} from "mongoose";

export class UnitCostService extends BaseCrudService<IUnitCost, typeof UnitCost> {
    constructor() {
        super(UnitCost, "UnitCost");
    }

    /** Unit costs with their unit, project and currency, for the ERP export. */
    findForErpExport(filter: FilterQuery<IUnitCost>) {
        return this.model.find(filter)
            .select("name unit project purchaseDate expenditureItems currency verificationStatus paymentStatus")
            .populate("unit", "name unitNumber")
            .populate("project", "name")
            .populate("currency", "abbreviation symbol")
            .lean();
    }
}

export const unitCostService = new UnitCostService();
