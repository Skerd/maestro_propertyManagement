import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import CommissioningRecord, {ICommissioningRecord} from "./commissioningRecord";

export class CommissioningRecordService extends BaseCrudService<ICommissioningRecord, typeof CommissioningRecord> {
    constructor() {
        super(CommissioningRecord, "CommissioningRecord");
    }
}

export const commissioningRecordService = new CommissioningRecordService();
