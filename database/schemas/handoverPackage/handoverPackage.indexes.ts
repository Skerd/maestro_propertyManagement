import {Schema} from "mongoose";
import {IHandoverPackage} from "./handoverPackage";

export function applyHandoverPackageIndexes(schema: Schema<IHandoverPackage>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
