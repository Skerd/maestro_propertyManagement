import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import UnitTypeCategory, {IUnitTypeCategory} from "./unitTypeCategory";

export class UnitTypeCategoryService extends BaseCrudService<IUnitTypeCategory, typeof UnitTypeCategory> {
    constructor() {
        super(UnitTypeCategory, "UnitTypeCategory");
    }
}

export const unitTypeCategoryService = new UnitTypeCategoryService();
