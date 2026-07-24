import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import SiteDiary, {ISiteDiary} from "./siteDiary";

export class SiteDiaryService extends BaseCrudService<ISiteDiary, typeof SiteDiary> {
    constructor() {
        super(SiteDiary, "SiteDiary");
    }
}

export const siteDiaryService = new SiteDiaryService();
