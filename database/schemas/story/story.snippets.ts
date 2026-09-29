import type {StorySimple} from "armonia/src/modules/propertyManagement/dto/story.dto";
import type {IStory} from "@propertyManagement/database/schemas/story/story";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const StorySimpleSnippet = defineSnippet<IStory, StorySimple>()({
    keys: {
        _id: {},
        name: {},
        title: {},
    },
});
