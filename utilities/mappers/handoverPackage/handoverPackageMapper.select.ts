import type {IHandoverPackage} from "../../../database/schemas/handoverPackage/handoverPackage";

export function handoverPackagesToSelect(docs: IHandoverPackage[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
