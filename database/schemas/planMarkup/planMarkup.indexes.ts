import {Schema} from "mongoose";
import {IPlanMarkup} from "./planMarkup";

export function applyPlanMarkupIndexes(schema: Schema<IPlanMarkup>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({planDocument: 1, status: 1});
    schema.index({project: 1, markerType: 1}, {sparse: true});
}
