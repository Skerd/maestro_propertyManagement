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
import {InspectionChecklistTemplateSchemaDef, inspectionChecklistTemplateStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/inspectionChecklistTemplate.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {inspectionChecklistTemplateViews} from "./inspectionChecklistTemplate.views";
import {applyInspectionChecklistTemplateIndexes} from "./inspectionChecklistTemplate.indexes";

export interface IInspectionChecklistTemplate extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const InspectionChecklistTemplateSchema = new Schema<IInspectionChecklistTemplate>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        title: {type: SchemaTypes.String, required: true, trim: true},
        trade: {type: SchemaTypes.String, required: false},
        stage: {type: SchemaTypes.String, required: false},
        description: {type: SchemaTypes.String, required: false},
        itemsJson: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...inspectionChecklistTemplateStatusValues],
            required: false,
            default: "active",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

InspectionChecklistTemplateSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `CHK-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(InspectionChecklistTemplateSchema);
auditPlugin(InspectionChecklistTemplateSchema);
softDeletePlugin(InspectionChecklistTemplateSchema);
applyInspectionChecklistTemplateIndexes(InspectionChecklistTemplateSchema);

const InspectionChecklistTemplate = model<IInspectionChecklistTemplate>("InspectionChecklistTemplate", InspectionChecklistTemplateSchema, "inspectionchecklisttemplates");
export default InspectionChecklistTemplate;

normalizeSchemaPermissions(InspectionChecklistTemplate);
addModelData(InspectionChecklistTemplate, inspectionChecklistTemplateViews);
validateSchemaDefAgainstMongoose(InspectionChecklistTemplateSchema, InspectionChecklistTemplateSchemaDef, "InspectionChecklistTemplate", ["name", "status"]);
