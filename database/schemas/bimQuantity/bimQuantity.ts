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
import {BimQuantitySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimQuantity/bimQuantity.schema-def";
import {BimModelSimpleSnippet} from "../bimModel/bimModel.snippets";
import {bimQuantityViews} from "./bimQuantity.views";
import {applyBimQuantityIndexes} from "./bimQuantity.indexes";

export interface IBimQuantity extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    [key: string]: any;
}

const BimQuantitySchema = new Schema<IBimQuantity>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        bimModel: {type: SchemaTypes.ObjectId, ref: "BimModel", required: true, refAllowlist: BimModelSimpleSnippet},
        ifcElementType: {type: SchemaTypes.String, required: false, trim: true},
        classificationCode: {type: SchemaTypes.String, required: false, trim: true},
        quantity: {type: SchemaTypes.Number, required: false},
        unitOfMeasure: {type: SchemaTypes.String, required: false, trim: true},
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"},
);

BimQuantitySchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `BIMQ-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(BimQuantitySchema);
auditPlugin(BimQuantitySchema);
softDeletePlugin(BimQuantitySchema);
applyBimQuantityIndexes(BimQuantitySchema);

const BimQuantity = model<IBimQuantity>("BimQuantity", BimQuantitySchema, "bimquantities");
export default BimQuantity;

normalizeSchemaPermissions(BimQuantity);
addModelData(BimQuantity, bimQuantityViews);
validateSchemaDefAgainstMongoose(BimQuantitySchema, BimQuantitySchemaDef, "BimQuantity", ["name"]);
