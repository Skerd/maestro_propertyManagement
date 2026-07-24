import {Schema} from "mongoose";
import {IBidLine} from "./bidLine";

export function applyBidLineIndexes(schema: Schema<IBidLine>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({bid: 1, sortIndex: 1});
    schema.index({specificationItem: 1}, {sparse: true});
}
