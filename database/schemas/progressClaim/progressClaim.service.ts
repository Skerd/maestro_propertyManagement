import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ProgressClaim, {IProgressClaim} from "./progressClaim";

export class ProgressClaimService extends BaseCrudService<IProgressClaim, typeof ProgressClaim> {
    constructor() {
        super(ProgressClaim, "ProgressClaim");
    }
}

export const progressClaimService = new ProgressClaimService();
