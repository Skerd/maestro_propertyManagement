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
import {BoqItemSchemaDef, boqItemStatusValues, boqItemClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/boqItem/boqItem.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {boqItemViews} from "./boqItem.views";
import {applyBoqItemIndexes} from "./boqItem.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";

export interface IBoqItem extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const BoqItemSchema = new Schema<IBoqItem>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        budget: {type: SchemaTypes.ObjectId, ref: "Budget", required: true},
        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: false},
        classificationStandard: {type: SchemaTypes.String, enum: [...boqItemClassificationStandardValues], required: false},
        classificationCode: {type: SchemaTypes.String, required: false, trim: true},
        elementCode: {type: SchemaTypes.String, required: false, trim: true},
        wbsCode: {type: SchemaTypes.String, required: false, trim: true},
        trade: {type: SchemaTypes.String, required: false},
        category: {type: SchemaTypes.String, required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: false},
        unitOfMeasure: {type: SchemaTypes.String, required: false},
        plannedQty: {type: SchemaTypes.Number, required: false},
        plannedRate: {type: SchemaTypes.Decimal128, required: false},
        plannedAmount: {type: SchemaTypes.Decimal128, required: false},
        actualQty: {type: SchemaTypes.Number, required: false},
        actualAmount: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...boqItemStatusValues],
            required: false,
            default: "active",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

BoqItemSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `BOQ-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(BoqItemSchema);
auditPlugin(BoqItemSchema);
softDeletePlugin(BoqItemSchema);
applyBoqItemIndexes(BoqItemSchema);

const BoqItem = model<IBoqItem>("BoqItem", BoqItemSchema, "boqitems");
export default BoqItem;

normalizeSchemaPermissions(BoqItem);
addModelData(BoqItem, boqItemViews);
validateSchemaDefAgainstMongoose(BoqItemSchema, BoqItemSchemaDef, "BoqItem", ["name", "status"]);
