import {Schema} from "mongoose";
import {IBid} from "./bid";

export function applyBidIndexes(schema: Schema<IBid>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({tender: 1, status: 1});
    schema.index({constructorRef: 1}, {sparse: true});
    schema.index({tenderInvitation: 1}, {sparse: true});
}
