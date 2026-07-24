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
import {BimModelSchemaDef, bimModelImportStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/bimModel.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {bimModelViews} from "./bimModel.views";
import {applyBimModelIndexes} from "./bimModel.indexes";

export interface IBimModel extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    importStatus?: string;
    [key: string]: any;
}

const BimModelSchema = new Schema<IBimModel>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: false, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        version: {type: SchemaTypes.String, required: false, trim: true},
        sourceFile: {type: SchemaTypes.ObjectId, ref: "Media", required: false},
        elementCount: {type: SchemaTypes.Number, required: false, permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}}},
        notes: {type: SchemaTypes.String, required: false},

        importStatus: {
            type: SchemaTypes.String,
            enum: [...bimModelImportStatusValues],
            required: false,
            default: "uploaded",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

BimModelSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `BIM-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(BimModelSchema);
auditPlugin(BimModelSchema);
softDeletePlugin(BimModelSchema);
applyBimModelIndexes(BimModelSchema);

const BimModel = model<IBimModel>("BimModel", BimModelSchema, "bimmodels");
export default BimModel;

normalizeSchemaPermissions(BimModel);
addModelData(BimModel, bimModelViews);
validateSchemaDefAgainstMongoose(BimModelSchema, BimModelSchemaDef, "BimModel", ["name", "importStatus", "elementCount"]);
