import {Schema} from "mongoose";
import {ITenderInvitation} from "./tenderInvitation";

export function applyTenderInvitationIndexes(schema: Schema<ITenderInvitation>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({tender: 1, status: 1});
    schema.index({constructorRef: 1}, {sparse: true});
    schema.index({portalAccessToken: 1}, {sparse: true});
}
