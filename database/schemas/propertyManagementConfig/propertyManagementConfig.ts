import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {PropertyManagementConfigSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/propertyManagementConfig.schema-def";
import {propertyManagementConfigViews} from "./propertyManagementConfig.views";
import {applyPropertyManagementConfigIndexes} from "./propertyManagementConfig.indexes";

export interface IPropertyManagementConfig extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    requiresSaleApproval?: boolean;
    requiresHandoverPackageForHandover?: boolean;
    [key: string]: any;
}

const PropertyManagementConfigSchema = new Schema<IPropertyManagementConfig>(
    {
        requiresSaleApproval: {type: SchemaTypes.Boolean, required: false, default: false},
        requiresHandoverPackageForHandover: {type: SchemaTypes.Boolean, required: false, default: false},
    },
    {accessMode: "loose"},
);

ownershipPlugin(PropertyManagementConfigSchema);
auditPlugin(PropertyManagementConfigSchema);
softDeletePlugin(PropertyManagementConfigSchema);
applyPropertyManagementConfigIndexes(PropertyManagementConfigSchema);

const PropertyManagementConfig = model<IPropertyManagementConfig>(
    "PropertyManagementConfig",
    PropertyManagementConfigSchema,
    "propertymanagementconfigs",
);
export default PropertyManagementConfig;

normalizeSchemaPermissions(PropertyManagementConfig);
addModelData(PropertyManagementConfig, propertyManagementConfigViews);
validateSchemaDefAgainstMongoose(
    PropertyManagementConfigSchema,
    PropertyManagementConfigSchemaDef,
    "PropertyManagementConfig",
);
