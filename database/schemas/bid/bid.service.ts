import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Bid, {IBid} from "./bid";

export class BidService extends BaseCrudService<IBid, typeof Bid> {
    constructor() {
        super(Bid, "Bid");
    }
}

export const bidService = new BidService();
