import type {IStoryType} from "../../../database/schemas/storyType/storyType";
import type {StoryType} from "armonia/src/modules/propertyManagement/api/realEstate/private/storyType/storyType.dto";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function storyTypeToDTO(storyType: IStoryType): StoryType {
    return {
        _id: storyType._id.toString(),
        name: storyType.name,
        slug: storyType.slug,
        description: storyType.description ?? undefined,
        sortOrder: storyType.sortOrder ?? 0,
        ...mapSoftDeleteToDTO(storyType),
        ...mapOwnershipToDTO(storyType),
        ...mapLifeCycleToDTO(storyType),
    };
}

export function storyTypesToDTO(storyTypes: IStoryType[]): StoryType[] {
    return storyTypes.map(storyTypeToDTO);
}
