import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {AssetSchemaDef, assetLifecycleStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/asset.schema-def";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {assetViews} from "./asset.views";
import {applyAssetIndexes} from "./asset.indexes";

export interface IAsset extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    lifecycleStatus?: string;
    [key: string]: any;
}

const AssetSchema = new Schema<IAsset>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        unit: {type: SchemaTypes.ObjectId, ref: "Unit", required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        category: {type: SchemaTypes.String, required: false, trim: true},
        manufacturer: {type: SchemaTypes.String, required: false, trim: true},
        serial: {type: SchemaTypes.String, required: false, trim: true},
        installDate: {type: SchemaTypes.Date, required: false},
        warranty: {type: SchemaTypes.ObjectId, ref: "Warranty", required: false},
        notes: {type: SchemaTypes.String, required: false},

        lifecycleStatus: {
            type: SchemaTypes.String,
            enum: [...assetLifecycleStatusValues],
            required: false,
            default: "active",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

AssetSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `AST-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(AssetSchema);
auditPlugin(AssetSchema);
softDeletePlugin(AssetSchema);
applyAssetIndexes(AssetSchema);

const Asset = model<IAsset>("Asset", AssetSchema, "assets");
export default Asset;

normalizeSchemaPermissions(Asset);
addModelData(Asset, assetViews);
validateSchemaDefAgainstMongoose(AssetSchema, AssetSchemaDef, "Asset", ["name", "lifecycleStatus"]);
