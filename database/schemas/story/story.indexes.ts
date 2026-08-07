import {Schema} from "mongoose";

export function applyStoryIndexes(schema: Schema): void {
    schema.index({name: 1}, {unique: true});
    schema.index({company: 1, deletedAt: 1, published: 1, sortOrder: 1, publishedAt: -1});
    schema.index({project: 1, published: 1, sortOrder: 1, publishedAt: -1});
    schema.index({edifice: 1, publishedAt: -1});
    schema.index({unit: 1, publishedAt: -1});
}
