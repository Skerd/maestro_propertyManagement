import type {IWorkPackage} from "../../../database/schemas/workPackage/workPackage";

export function workPackagesToSelect(docs: IWorkPackage[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
