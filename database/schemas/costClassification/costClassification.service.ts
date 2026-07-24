import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import CostClassification, {ICostClassification} from "./costClassification";

export class CostClassificationService extends BaseCrudService<ICostClassification, typeof CostClassification> {
    constructor() {
        super(CostClassification, "CostClassification");
    }
}

export const costClassificationService = new CostClassificationService();
