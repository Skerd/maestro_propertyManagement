import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Snag, {ISnag} from "./snag";

export class SnagService extends BaseCrudService<ISnag, typeof Snag> {
    constructor() {
        super(Snag, "Snag");
    }
}

export const snagService = new SnagService();
