import {Schema} from "mongoose";
import {IBudget} from "./budget";

export function applyBudgetIndexes(schema: Schema<IBudget>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
