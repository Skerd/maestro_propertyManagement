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
import {LiquidityPlanSchemaDef, liquidityGranularityValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/liquidityPlan.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {liquidityPlanViews} from "./liquidityPlan.views";
import {applyLiquidityPlanIndexes} from "./liquidityPlan.indexes";

export interface ILiquidityPlan extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    [key: string]: any;
}

const LiquidityPlanSchema = new Schema<ILiquidityPlan>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        horizonStart: {type: SchemaTypes.Date, required: false},
        horizonEnd: {type: SchemaTypes.Date, required: false},
        granularity: {type: SchemaTypes.String, enum: [...liquidityGranularityValues], required: false, default: "monthly"},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"},
);

LiquidityPlanSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `LIQ-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(LiquidityPlanSchema);
auditPlugin(LiquidityPlanSchema);
softDeletePlugin(LiquidityPlanSchema);
applyLiquidityPlanIndexes(LiquidityPlanSchema);

const LiquidityPlan = model<ILiquidityPlan>("LiquidityPlan", LiquidityPlanSchema, "liquidityplans");
export default LiquidityPlan;

normalizeSchemaPermissions(LiquidityPlan);
addModelData(LiquidityPlan, liquidityPlanViews);
validateSchemaDefAgainstMongoose(LiquidityPlanSchema, LiquidityPlanSchemaDef, "LiquidityPlan", ["name"]);
