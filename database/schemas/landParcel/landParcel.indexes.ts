import {Schema} from "mongoose";
import {ILandParcel} from "./landParcel";

export function applyLandParcelIndexes(schema: Schema<ILandParcel>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
