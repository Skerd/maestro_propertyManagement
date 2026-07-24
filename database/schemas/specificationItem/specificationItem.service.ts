import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import SpecificationItem, {ISpecificationItem} from "./specificationItem";

export class SpecificationItemService extends BaseCrudService<ISpecificationItem, typeof SpecificationItem> {
    constructor() {
        super(SpecificationItem, "SpecificationItem");
    }
}

export const specificationItemService = new SpecificationItemService();
