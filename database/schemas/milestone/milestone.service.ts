import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Milestone, {IMilestone} from "./milestone";

export class MilestoneService extends BaseCrudService<IMilestone, typeof Milestone> {
    constructor() {
        super(Milestone, "Milestone");
    }
}

export const milestoneService = new MilestoneService();
