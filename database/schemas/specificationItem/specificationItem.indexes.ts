import {Schema} from "mongoose";
import {ISpecificationItem} from "./specificationItem";

export function applySpecificationItemIndexes(schema: Schema<ISpecificationItem>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({specification: 1, sortIndex: 1});
    schema.index({specification: 1, status: 1});
    schema.index({classificationCode: 1}, {sparse: true});
}
