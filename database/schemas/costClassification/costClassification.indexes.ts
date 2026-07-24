import {Schema} from "mongoose";
import {ICostClassification} from "./costClassification";

export function applyCostClassificationIndexes(schema: Schema<ICostClassification>): void {
    // Company-scoped uniqueness: reference data is seeded per company with deterministic
    // names/codes, so the same eBKP-H code exists once per company (not globally unique).
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({company: 1, standard: 1, code: 1}, {unique: true});
    schema.index({standard: 1, parentCode: 1, sortIndex: 1});
    schema.index({active: 1});
}
