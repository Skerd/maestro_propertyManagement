import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import BimModel, {IBimModel} from "./bimModel";
export class BimModelService extends BaseCrudService<IBimModel, typeof BimModel> {
    constructor() { super(BimModel, "BimModel"); }
}
export const bimModelService = new BimModelService();
