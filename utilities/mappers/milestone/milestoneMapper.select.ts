import type {IMilestone} from "../../../database/schemas/milestone/milestone";

export function milestonesToSelect(docs: IMilestone[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
