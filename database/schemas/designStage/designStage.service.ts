import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import DesignStage, {IDesignStage} from "./designStage";

export class DesignStageService extends BaseCrudService<IDesignStage, typeof DesignStage> {
    constructor() {
        super(DesignStage, "DesignStage");
    }
}

export const designStageService = new DesignStageService();
