import {Schema} from "mongoose";
import {IProjectDocument} from "./projectDocument";

export function applyProjectDocumentIndexes(schema: Schema<IProjectDocument>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({project: 1, status: 1});
    schema.index({discipline: 1});
    schema.index({documentNumber: 1});
}
