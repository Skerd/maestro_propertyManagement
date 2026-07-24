import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import BimQuantity, {IBimQuantity} from "./bimQuantity";
export class BimQuantityService extends BaseCrudService<IBimQuantity, typeof BimQuantity> {
    constructor() { super(BimQuantity, "BimQuantity"); }
}
export const bimQuantityService = new BimQuantityService();
