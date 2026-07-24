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
import {ProgressClaimSchemaDef, progressClaimStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/progressClaim/progressClaim.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {progressClaimViews} from "./progressClaim.views";
import {applyProgressClaimIndexes} from "./progressClaim.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface IProgressClaim extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const ProgressClaimSchema = new Schema<IProgressClaim>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        constructionContract: {type: SchemaTypes.ObjectId, ref: "ConstructionContract", required: true},
        title: {type: SchemaTypes.String, required: true, trim: true},
        claimPeriodStart: {type: SchemaTypes.Date, required: false},
        claimPeriodEnd: {type: SchemaTypes.Date, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        amount: {type: SchemaTypes.Decimal128, required: true},
        certifiedAmount: {type: SchemaTypes.Decimal128, required: false},
        retentionHeld: {type: SchemaTypes.Decimal128, required: false},
        retentionReleased: {type: SchemaTypes.Decimal128, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...progressClaimStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

ProgressClaimSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `CLAIM-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ProgressClaimSchema);
auditPlugin(ProgressClaimSchema);
softDeletePlugin(ProgressClaimSchema);
applyProgressClaimIndexes(ProgressClaimSchema);

const ProgressClaim = model<IProgressClaim>("ProgressClaim", ProgressClaimSchema, "progressclaims");
export default ProgressClaim;

normalizeSchemaPermissions(ProgressClaim);
addModelData(ProgressClaim, progressClaimViews);
validateSchemaDefAgainstMongoose(ProgressClaimSchema, ProgressClaimSchemaDef, "ProgressClaim", ["name", "status"]);
