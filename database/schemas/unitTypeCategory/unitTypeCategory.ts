import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields,
} from "@coreModule/database/types/plugin-fields";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {addModelData} from "@coreModule/database/collections";
import {applyUnitTypeCategoryIndexes} from "./unitTypeCategory.indexes";
import {unitTypeCategoryViews} from "./unitTypeCategory.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {UnitTypeCategorySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitTypeCategory/unitTypeCategory.schema-def";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IUnitTypeCategory extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
}

const UnitTypeCategorySchema = new Schema<IUnitTypeCategory>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.TEXT,
            },
        },
    },
    {
        accessMode: "loose",
    },
);

ownershipPlugin(UnitTypeCategorySchema);
auditPlugin(UnitTypeCategorySchema);
softDeletePlugin(UnitTypeCategorySchema);
lifeCyclePlugin(UnitTypeCategorySchema);
applyUnitTypeCategoryIndexes(UnitTypeCategorySchema);

const UnitTypeCategory = model<IUnitTypeCategory>("UnitTypeCategory", UnitTypeCategorySchema);
normalizeSchemaPermissions(UnitTypeCategory);
export default UnitTypeCategory;

addModelData(UnitTypeCategory, unitTypeCategoryViews);
validateSchemaDefAgainstMongoose(UnitTypeCategorySchema, UnitTypeCategorySchemaDef, "UnitTypeCategory", ["company"]);
