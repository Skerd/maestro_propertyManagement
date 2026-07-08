import type {IConstructionUpdate} from "../../../database/schemas/constructionUpdate/constructionUpdate";

export function constructionUpdatesToSelect(docs: IConstructionUpdate[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
