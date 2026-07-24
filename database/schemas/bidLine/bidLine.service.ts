import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import BidLine, {IBidLine} from "./bidLine";

export class BidLineService extends BaseCrudService<IBidLine, typeof BidLine> {
    constructor() {
        super(BidLine, "BidLine");
    }
}

export const bidLineService = new BidLineService();
