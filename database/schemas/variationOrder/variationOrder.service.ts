import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VariationOrder, {IVariationOrder} from "./variationOrder";

export class VariationOrderService extends BaseCrudService<IVariationOrder, typeof VariationOrder> {
    constructor() {
        super(VariationOrder, "VariationOrder");
    }
}

export const variationOrderService = new VariationOrderService();
