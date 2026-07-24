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
import {CostCommitmentSchemaDef, costCommitmentStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/costCommitment.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {costCommitmentViews} from "./costCommitment.views";
import {applyCostCommitmentIndexes} from "./costCommitment.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface ICostCommitment extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const CostCommitmentSchema = new Schema<ICostCommitment>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        budget: {type: SchemaTypes.ObjectId, ref: "Budget", required: false},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        committedAmount: {type: SchemaTypes.Decimal128, required: true},
        retentionPercent: {type: SchemaTypes.Number, required: false},
        issuedAt: {type: SchemaTypes.Date, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...costCommitmentStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

CostCommitmentSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `PO-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(CostCommitmentSchema);
auditPlugin(CostCommitmentSchema);
softDeletePlugin(CostCommitmentSchema);
applyCostCommitmentIndexes(CostCommitmentSchema);

const CostCommitment = model<ICostCommitment>("CostCommitment", CostCommitmentSchema, "costcommitments");
export default CostCommitment;

normalizeSchemaPermissions(CostCommitment);
addModelData(CostCommitment, costCommitmentViews);
validateSchemaDefAgainstMongoose(CostCommitmentSchema, CostCommitmentSchemaDef, "CostCommitment", ["name", "status"]);
