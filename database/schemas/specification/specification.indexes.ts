import {Schema} from "mongoose";
import {ISpecification} from "./specification";

export function applySpecificationIndexes(schema: Schema<ISpecification>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
    schema.index({workPackage: 1}, {sparse: true});
}
