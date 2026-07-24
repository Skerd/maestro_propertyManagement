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
import {LiquidityLineSchemaDef, liquidityDirectionValues, liquiditySourceValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityLine/liquidityLine.schema-def";
import {LiquidityPlanSimpleSnippet} from "../liquidityPlan/liquidityPlan.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {liquidityLineViews} from "./liquidityLine.views";
import {applyLiquidityLineIndexes} from "./liquidityLine.indexes";

export interface ILiquidityLine extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    direction: string;
    [key: string]: any;
}

const LiquidityLineSchema = new Schema<ILiquidityLine>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        plan: {type: SchemaTypes.ObjectId, ref: "LiquidityPlan", required: true, refAllowlist: LiquidityPlanSimpleSnippet},
        period: {type: SchemaTypes.Date, required: false},
        direction: {type: SchemaTypes.String, enum: [...liquidityDirectionValues], required: true},
        source: {type: SchemaTypes.String, enum: [...liquiditySourceValues], required: false, default: "manual"},
        title: {type: SchemaTypes.String, required: false, trim: true},
        plannedAmount: {type: SchemaTypes.Decimal128, required: false},
        actualAmount: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"},
);

LiquidityLineSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `LIQL-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(LiquidityLineSchema);
auditPlugin(LiquidityLineSchema);
softDeletePlugin(LiquidityLineSchema);
applyLiquidityLineIndexes(LiquidityLineSchema);

const LiquidityLine = model<ILiquidityLine>("LiquidityLine", LiquidityLineSchema, "liquiditylines");
export default LiquidityLine;

normalizeSchemaPermissions(LiquidityLine);
addModelData(LiquidityLine, liquidityLineViews);
validateSchemaDefAgainstMongoose(LiquidityLineSchema, LiquidityLineSchemaDef, "LiquidityLine", ["name"]);
