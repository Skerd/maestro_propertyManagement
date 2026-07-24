import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import FeeCalculation, {IFeeCalculation} from "./feeCalculation";

export class FeeCalculationService extends BaseCrudService<IFeeCalculation, typeof FeeCalculation> {
    constructor() {
        super(FeeCalculation, "FeeCalculation");
    }
}

export const feeCalculationService = new FeeCalculationService();
