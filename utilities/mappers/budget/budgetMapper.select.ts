import type {IBudget} from "../../../database/schemas/budget/budget";

export function budgetsToSelect(docs: IBudget[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
