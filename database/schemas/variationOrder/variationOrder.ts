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
import {VariationOrderSchemaDef, variationOrderStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/variationOrder/variationOrder.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {ModificationRequestSimpleSnippet} from "../modificationRequest/modificationRequest.snippets";
import {variationOrderViews} from "./variationOrder.views";
import {applyVariationOrderIndexes} from "./variationOrder.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface IVariationOrder extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const VariationOrderSchema = new Schema<IVariationOrder>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        constructionContract: {type: SchemaTypes.ObjectId, ref: "ConstructionContract", required: false},
        modificationRequest: {type: SchemaTypes.ObjectId, ref: "ModificationRequest", required: false, refAllowlist: ModificationRequestSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: true},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        costImpact: {type: SchemaTypes.Decimal128, required: false},
        timeImpactDays: {type: SchemaTypes.Number, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        // Baufinanz Nachträge grouped billing (§3.I): set by billVariations, server-managed.
        billedAt: {type: SchemaTypes.Date, required: false, permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}}},
        billingReference: {type: SchemaTypes.String, required: false, permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}}},

        status: {
            type: SchemaTypes.String,
            enum: [...variationOrderStatusValues],
            required: false,
            default: "pending_architect",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

VariationOrderSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `VO-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(VariationOrderSchema);
auditPlugin(VariationOrderSchema);
softDeletePlugin(VariationOrderSchema);
applyVariationOrderIndexes(VariationOrderSchema);

const VariationOrder = model<IVariationOrder>("VariationOrder", VariationOrderSchema, "variationorders");
export default VariationOrder;

normalizeSchemaPermissions(VariationOrder);
addModelData(VariationOrder, variationOrderViews);
validateSchemaDefAgainstMongoose(VariationOrderSchema, VariationOrderSchemaDef, "VariationOrder", ["name", "status", "billedAt", "billingReference"]);
