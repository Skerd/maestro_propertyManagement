import {Schema} from "mongoose";

export function applyStoryTypeIndexes(StoryTypeSchema: Schema): void {
    StoryTypeSchema.index({name: 1});
    StoryTypeSchema.index({slug: 1});
    StoryTypeSchema.index({company: 1, deletedAt: 1, sortOrder: 1, name: 1});
}
