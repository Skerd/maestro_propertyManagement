import {Schema} from "mongoose";
import {IPermit} from "./permit";

export function applyPermitIndexes(schema: Schema<IPermit>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({project: 1, status: 1});
    schema.index({edifice: 1, status: 1});
    schema.index({status: 1, expiresAt: 1});
    schema.index({referenceNumber: 1});
}
