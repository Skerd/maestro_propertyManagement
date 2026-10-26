import {Schema} from "mongoose";

export function applyStoryTypeIndexes(StoryTypeSchema: Schema): void {
    StoryTypeSchema.index({company: 1, name: 1}, {unique: true});
    StoryTypeSchema.index({company: 1, slug: 1}, {unique: true});
    StoryTypeSchema.index({company: 1, deletedAt: 1, sortOrder: 1, name: 1});
}
