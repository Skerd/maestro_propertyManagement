import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Submittal, {ISubmittal} from "./submittal";

export class SubmittalService extends BaseCrudService<ISubmittal, typeof Submittal> {
    constructor() {
        super(Submittal, "Submittal");
    }
}

export const submittalService = new SubmittalService();
