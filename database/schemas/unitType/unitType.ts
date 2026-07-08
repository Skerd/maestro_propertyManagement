import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import {applyUnitTypeIndexes} from "./unitType.indexes";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {unitTypeViews} from "./unitType.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {UnitTypeSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitType/unitType.schema-def";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

import {IUnitTypeCategory} from "../unitTypeCategory/unitTypeCategory";
import {UnitTypeCategorySimpleSnippet} from "../unitTypeCategory/unitTypeCategory.snippets";

export interface IUnitType extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    slug: string;
    category: IUnitTypeCategory;
    group: string;
    description: string;
    icon: string;
    isPrivate: boolean;
}

const UnitTypeSchema = new Schema<IUnitType>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
            trim: true,
        },
        slug: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        category: {
            type: SchemaTypes.ObjectId,
            ref: "UnitTypeCategory",
            required: true,
            refAllowlist: UnitTypeCategorySimpleSnippet,
        },
        group: {
            type: SchemaTypes.String,
        },
        description: {
            type: SchemaTypes.String,
            default: '',
        },
        icon: {
            type: SchemaTypes.String,
            default: '',
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.MDIICON
            }
        },
        isPrivate: {
            type: SchemaTypes.Boolean,
            default: true
        },
    },
    {
        accessMode: "loose"
    }
);

ownershipPlugin(UnitTypeSchema);
auditPlugin(UnitTypeSchema);
softDeletePlugin(UnitTypeSchema);
lifeCyclePlugin(UnitTypeSchema);
applyUnitTypeIndexes(UnitTypeSchema);
const UnitType = model<IUnitType>('UnitType', UnitTypeSchema);
normalizeSchemaPermissions(UnitType);
export default UnitType;

addModelData(UnitType, unitTypeViews);
validateSchemaDefAgainstMongoose(UnitTypeSchema, UnitTypeSchemaDef, "UnitType", ["slug", "company"]);
