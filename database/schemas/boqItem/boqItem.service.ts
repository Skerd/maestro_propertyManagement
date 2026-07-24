import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import BoqItem, {IBoqItem} from "./boqItem";

export class BoqItemService extends BaseCrudService<IBoqItem, typeof BoqItem> {
    constructor() {
        super(BoqItem, "BoqItem");
    }
}

export const boqItemService = new BoqItemService();
