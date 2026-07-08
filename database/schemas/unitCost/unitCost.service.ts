import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import UnitCost, {IUnitCost} from "./unitCost";

export class UnitCostService extends BaseCrudService<IUnitCost, typeof UnitCost> {
    constructor() {
        super(UnitCost, "UnitCost");
    }
}

export const unitCostService = new UnitCostService();
