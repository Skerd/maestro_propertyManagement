import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Lead, {ILead} from "./lead";

export class LeadService extends BaseCrudService<ILead, typeof Lead> {
    constructor() {
        super(Lead, "Lead");
    }
}

export const leadService = new LeadService();
