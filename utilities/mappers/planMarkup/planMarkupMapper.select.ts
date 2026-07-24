import type {IPlanMarkup} from "../../../database/schemas/planMarkup/planMarkup";

export function planMarkupsToSelect(docs: IPlanMarkup[]) {
    return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name}));
}
