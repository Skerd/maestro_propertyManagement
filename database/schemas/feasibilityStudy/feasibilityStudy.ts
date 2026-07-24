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
import {FeasibilityStudySchemaDef, feasibilityStudyStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/feasibilityStudy.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {feasibilityStudyViews} from "./feasibilityStudy.views";
import {applyFeasibilityStudyIndexes} from "./feasibilityStudy.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";

export interface IFeasibilityStudy extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const FeasibilityStudySchema = new Schema<IFeasibilityStudy>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        landParcel: {type: SchemaTypes.ObjectId, ref: "LandParcel", required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        assumptions: {type: SchemaTypes.String, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        softCostEstimate: {type: SchemaTypes.Decimal128, required: false},
        hardCostEstimate: {type: SchemaTypes.Decimal128, required: false},
        residualValue: {type: SchemaTypes.Decimal128, required: false},
        irrPercent: {type: SchemaTypes.Number, required: false},
        decision: {type: SchemaTypes.String, required: false},
        decisionNotes: {type: SchemaTypes.String, required: false},
        decidedBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        decidedAt: {type: SchemaTypes.Date, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...feasibilityStudyStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

FeasibilityStudySchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `FEAS-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(FeasibilityStudySchema);
auditPlugin(FeasibilityStudySchema);
softDeletePlugin(FeasibilityStudySchema);
applyFeasibilityStudyIndexes(FeasibilityStudySchema);

const FeasibilityStudy = model<IFeasibilityStudy>("FeasibilityStudy", FeasibilityStudySchema, "feasibilitystudies");
export default FeasibilityStudy;

normalizeSchemaPermissions(FeasibilityStudy);
addModelData(FeasibilityStudy, feasibilityStudyViews);
validateSchemaDefAgainstMongoose(FeasibilityStudySchema, FeasibilityStudySchemaDef, "FeasibilityStudy", ["name", "status"]);
