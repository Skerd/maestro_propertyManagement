import {Schema} from "mongoose";
import {IHandoverPackage} from "./handoverPackage";

const notDeleted = {deletedAt: null};

export function applyHandoverPackageIndexes(schema: Schema<IHandoverPackage>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({company: 1, project: 1});
    // Same keys as the lookup index above, so it needs its own name.
    schema.index(
        {company: 1, project: 1},
        {
            unique: true,
            name: "company_1_project_1_projectLevel",
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
