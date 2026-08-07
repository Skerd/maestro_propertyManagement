import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import StoryType, {IStoryType} from "./storyType";

export class StoryTypeService extends BaseCrudService<IStoryType, typeof StoryType> {
    constructor() {
        super(StoryType, "StoryType");
    }
}

export const storyTypeService = new StoryTypeService();
