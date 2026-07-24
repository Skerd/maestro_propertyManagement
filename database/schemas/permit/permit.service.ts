import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Permit, {IPermit} from "./permit";

export class PermitService extends BaseCrudService<IPermit, typeof Permit> {
    constructor() {
        super(Permit, "Permit");
    }
}

export const permitService = new PermitService();
