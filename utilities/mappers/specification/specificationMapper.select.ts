import type {ISpecification} from "../../../database/schemas/specification/specification";

export function specificationsToSelect(docs: ISpecification[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
