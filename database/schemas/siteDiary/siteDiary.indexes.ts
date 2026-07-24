import {Schema} from "mongoose";
import {ISiteDiary} from "./siteDiary";

export function applySiteDiaryIndexes(schema: Schema<ISiteDiary>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
