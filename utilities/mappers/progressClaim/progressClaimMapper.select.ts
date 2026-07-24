import type {IProgressClaim} from "../../../database/schemas/progressClaim/progressClaim";

export function progressClaimsToSelect(docs: IProgressClaim[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
