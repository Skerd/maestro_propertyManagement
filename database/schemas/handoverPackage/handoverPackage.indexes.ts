import {Schema} from "mongoose";
import {IHandoverPackage} from "./handoverPackage";

const notDeleted = {deletedAt: null};

export function applyHandoverPackageIndexes(schema: Schema<IHandoverPackage>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({company: 1, project: 1});
    schema.index(
        {company: 1, project: 1},
        {
            unique: true,
            partialFilterExpression: {...notDeleted, edifice: null, floor: null, unit: null},
        },
    );
    schema.index(
        {company: 1, edifice: 1},
        {
            unique: true,
            partialFilterExpression: {...notDeleted, edifice: {$type: "objectId"}, floor: null, unit: null},
        },
    );
    schema.index(
        {company: 1, floor: 1},
        {
            unique: true,
            partialFilterExpression: {...notDeleted, floor: {$type: "objectId"}, unit: null},
        },
    );
    schema.index(
        {company: 1, unit: 1},
        {
            unique: true,
            partialFilterExpression: {...notDeleted, unit: {$type: "objectId"}},
        },
    );
}
