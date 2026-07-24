import {Schema} from "mongoose";
import {IConstructionContract} from "./constructionContract";

export function applyConstructionContractIndexes(schema: Schema<IConstructionContract>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
