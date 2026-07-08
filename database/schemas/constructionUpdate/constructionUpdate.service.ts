import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ConstructionUpdate, {IConstructionUpdate} from "./constructionUpdate";

export class ConstructionUpdateService extends BaseCrudService<IConstructionUpdate, typeof ConstructionUpdate> {
    constructor() {
        super(ConstructionUpdate, "ConstructionUpdate");
    }
}

export const constructionUpdateService = new ConstructionUpdateService();
