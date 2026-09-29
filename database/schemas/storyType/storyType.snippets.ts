import type {StoryTypeSimple} from "armonia/src/modules/propertyManagement/dto/storyType.dto";
import type {IStoryType} from "@propertyManagement/database/schemas/storyType/storyType";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const StoryTypeSimpleSnippet = defineSnippet<IStoryType, StoryTypeSimple>()({
    keys: {
        _id: {},
        name: {},
        slug: {},
        sortOrder: {},
    },
});
