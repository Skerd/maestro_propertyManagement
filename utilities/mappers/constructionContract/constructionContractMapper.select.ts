import type {IConstructionContract} from "../../../database/schemas/constructionContract/constructionContract";

export function constructionContractsToSelect(docs: IConstructionContract[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
