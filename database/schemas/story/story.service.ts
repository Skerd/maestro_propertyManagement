import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Story, {IStory} from "./story";

export class StoryService extends BaseCrudService<IStory, typeof Story> {
    constructor() {
        super(Story, "Story");
    }
}

export const storyService = new StoryService();
