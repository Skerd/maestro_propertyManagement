import type {IConstructionProgress} from "../../../database/schemas/constructionProgress/constructionProgress";

export function constructionProgressesToSelect(docs: IConstructionProgress[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
