import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import FeasibilityStudy, {IFeasibilityStudy} from "./feasibilityStudy";

export class FeasibilityStudyService extends BaseCrudService<IFeasibilityStudy, typeof FeasibilityStudy> {
    constructor() {
        super(FeasibilityStudy, "FeasibilityStudy");
    }
}

export const feasibilityStudyService = new FeasibilityStudyService();
