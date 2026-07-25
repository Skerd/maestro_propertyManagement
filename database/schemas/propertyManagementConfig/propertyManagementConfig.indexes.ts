import {Schema} from "mongoose";
import type {IPropertyManagementConfig} from "./propertyManagementConfig";

export function applyPropertyManagementConfigIndexes(schema: Schema<IPropertyManagementConfig>): void {
    // One active config document per company.
    schema.index(
        {company: 1},
        {unique: true, partialFilterExpression: {deletedAt: null}},
    );
}
