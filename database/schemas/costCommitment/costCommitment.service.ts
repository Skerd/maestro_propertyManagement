import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import CostCommitment, {ICostCommitment} from "./costCommitment";

export class CostCommitmentService extends BaseCrudService<ICostCommitment, typeof CostCommitment> {
    constructor() {
        super(CostCommitment, "CostCommitment");
    }
}

export const costCommitmentService = new CostCommitmentService();
