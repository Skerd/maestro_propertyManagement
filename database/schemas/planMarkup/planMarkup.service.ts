import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import PlanMarkup, {IPlanMarkup} from "./planMarkup";

export class PlanMarkupService extends BaseCrudService<IPlanMarkup, typeof PlanMarkup> {
    constructor() {
        super(PlanMarkup, "PlanMarkup");
    }
}

export const planMarkupService = new PlanMarkupService();
