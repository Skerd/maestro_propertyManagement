import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Warranty, {IWarranty} from "./warranty";

export class WarrantyService extends BaseCrudService<IWarranty, typeof Warranty> {
    constructor() {
        super(Warranty, "Warranty");
    }
}

export const warrantyService = new WarrantyService();
