import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Tender, {ITender} from "./tender";

export class TenderService extends BaseCrudService<ITender, typeof Tender> {
    constructor() {
        super(Tender, "Tender");
    }
}

export const tenderService = new TenderService();
