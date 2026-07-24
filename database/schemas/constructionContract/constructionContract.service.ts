import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ConstructionContract, {IConstructionContract} from "./constructionContract";

export class ConstructionContractService extends BaseCrudService<IConstructionContract, typeof ConstructionContract> {
    constructor() {
        super(ConstructionContract, "ConstructionContract");
    }
}

export const constructionContractService = new ConstructionContractService();
