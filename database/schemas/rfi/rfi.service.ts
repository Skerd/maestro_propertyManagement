import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Rfi, {IRfi} from "./rfi";

export class RfiService extends BaseCrudService<IRfi, typeof Rfi> {
    constructor() {
        super(Rfi, "Rfi");
    }
}

export const rfiService = new RfiService();
