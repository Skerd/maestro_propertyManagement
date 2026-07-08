import {Schema} from "mongoose";
import {ISnag} from "./snag";

export function applySnagIndexes(schema: Schema<ISnag>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({unit: 1, status: 1});
    schema.index({assignedTo: 1, status: 1});
    schema.index({status: 1, severity: 1});
    schema.index({dueDate: 1, status: 1});
}
