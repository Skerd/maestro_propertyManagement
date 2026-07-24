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
import {SpecificationItemSchemaDef, specificationItemStatusValues, specificationItemClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/specificationItem.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {SpecificationSimpleSnippet} from "../specification/specification.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {specificationItemViews} from "./specificationItem.views";
import {applySpecificationItemIndexes} from "./specificationItem.indexes";

export interface ISpecificationItem extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const SpecificationItemSchema = new Schema<ISpecificationItem>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        specification: {type: SchemaTypes.ObjectId, ref: "Specification", required: true, refAllowlist: SpecificationSimpleSnippet},
        project: {type: SchemaTypes.ObjectId, ref: "Project", required: false, refAllowlist: ProjectSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        npkChapter: {type: SchemaTypes.String, required: false, trim: true},
        npkPosition: {type: SchemaTypes.String, required: false, trim: true},
        isRPosition: {type: SchemaTypes.Boolean, required: false, default: false},
        description: {type: SchemaTypes.String, required: false},
        unitOfMeasure: {type: SchemaTypes.String, required: false},
        quantity: {type: SchemaTypes.Number, required: false},
        unitPrice: {type: SchemaTypes.Decimal128, required: false},
        lineTotal: {type: SchemaTypes.Decimal128, required: false},
        classificationStandard: {type: SchemaTypes.String, enum: [...specificationItemClassificationStandardValues], required: false},
        classificationCode: {type: SchemaTypes.String, required: false, trim: true},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        sortIndex: {type: SchemaTypes.Number, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...specificationItemStatusValues],
            required: false,
            default: "active",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

SpecificationItemSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `LVP-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(SpecificationItemSchema);
auditPlugin(SpecificationItemSchema);
softDeletePlugin(SpecificationItemSchema);
applySpecificationItemIndexes(SpecificationItemSchema);

const SpecificationItem = model<ISpecificationItem>("SpecificationItem", SpecificationItemSchema, "specificationitems");
export default SpecificationItem;

normalizeSchemaPermissions(SpecificationItem);
addModelData(SpecificationItem, specificationItemViews);
// lineTotal is server-computed (quantity * unitPrice); not part of the writable SchemaDef.
validateSchemaDefAgainstMongoose(SpecificationItemSchema, SpecificationItemSchemaDef, "SpecificationItem", ["name", "status", "lineTotal"]);
