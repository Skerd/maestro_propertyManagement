import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IStoryType} from "../../../database/schemas/storyType/storyType";

export function storyTypeToSelect(storyType: Pick<IStoryType, "_id" | "name">): ApiSelectDatum {
    return {
        value: storyType._id.toString(),
        label: storyType.name,
    };
}

export function storyTypesToSelect(storyTypes: Pick<IStoryType, "_id" | "name">[]): ApiSelectDatum[] {
    return storyTypes.map(storyTypeToSelect);
}
