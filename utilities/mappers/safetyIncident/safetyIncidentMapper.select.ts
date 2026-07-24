import type {ISafetyIncident} from "../../../database/schemas/safetyIncident/safetyIncident";

export function safetyIncidentsToSelect(docs: ISafetyIncident[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
