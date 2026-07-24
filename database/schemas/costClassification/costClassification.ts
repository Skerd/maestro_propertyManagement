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
import {CostClassificationSchemaDef, costClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/costClassification.schema-def";
import {costClassificationViews} from "./costClassification.views";
import {applyCostClassificationIndexes} from "./costClassification.indexes";

export interface ICostClassification extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    standard: string;
    code: string;
    title: string;
    active?: boolean;
    [key: string]: any;
}

const CostClassificationSchema = new Schema<ICostClassification>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        standard: {type: SchemaTypes.String, enum: [...costClassificationStandardValues], required: true},
        code: {type: SchemaTypes.String, required: true, trim: true},
        parentCode: {type: SchemaTypes.String, required: false, trim: true},
        level: {type: SchemaTypes.Number, required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        unitOfMeasure: {type: SchemaTypes.String, required: false, trim: true},
        sortIndex: {type: SchemaTypes.Number, required: false},
        active: {type: SchemaTypes.Boolean, required: false, default: true},
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"},
);

CostClassificationSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `CC-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(CostClassificationSchema);
auditPlugin(CostClassificationSchema);
softDeletePlugin(CostClassificationSchema);
applyCostClassificationIndexes(CostClassificationSchema);

const CostClassification = model<ICostClassification>("CostClassification", CostClassificationSchema, "costclassifications");
export default CostClassification;

normalizeSchemaPermissions(CostClassification);
addModelData(CostClassification, costClassificationViews);
validateSchemaDefAgainstMongoose(CostClassificationSchema, CostClassificationSchemaDef, "CostClassification", ["name"]);
