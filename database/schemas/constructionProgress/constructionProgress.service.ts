import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ConstructionProgress, {IConstructionProgress} from "./constructionProgress";

export class ConstructionProgressService extends BaseCrudService<IConstructionProgress, typeof ConstructionProgress> {
    constructor() {
        super(ConstructionProgress, "ConstructionProgress");
    }
}

export const constructionProgressService = new ConstructionProgressService();
