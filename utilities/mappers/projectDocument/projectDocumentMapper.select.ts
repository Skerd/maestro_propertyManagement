import type {IProjectDocument} from "../../../database/schemas/projectDocument/projectDocument";

export function projectDocumentsToSelect(docs: IProjectDocument[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
