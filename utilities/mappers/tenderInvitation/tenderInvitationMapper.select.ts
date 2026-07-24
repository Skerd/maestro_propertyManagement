import type {ITenderInvitation} from "../../../database/schemas/tenderInvitation/tenderInvitation";

export function tenderInvitationsToSelect(docs: ITenderInvitation[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.name,
    }));
}
