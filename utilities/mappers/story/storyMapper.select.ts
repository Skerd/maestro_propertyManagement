import type {IStory} from "../../../database/schemas/story/story";

export function storiesToSelect(docs: IStory[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
