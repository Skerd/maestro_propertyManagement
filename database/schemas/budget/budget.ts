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
import {BudgetSchemaDef, budgetStatusValues, budgetMethodValues, budgetClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/budget.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {BudgetSimpleSnippet} from "./budget.snippets";
import {budgetViews} from "./budget.views";
import {applyBudgetIndexes} from "./budget.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";

export interface IBudget extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const BudgetSchema = new Schema<IBudget>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        version: {type: SchemaTypes.Number, required: false, default: 1},
        method: {type: SchemaTypes.String, enum: [...budgetMethodValues], required: false},
        classificationStandard: {type: SchemaTypes.String, enum: [...budgetClassificationStandardValues], required: false},
        revisionNo: {type: SchemaTypes.Number, required: false},
        supersedesBudget: {type: SchemaTypes.ObjectId, ref: "Budget", required: false, refAllowlist: BudgetSimpleSnippet},
        // Forward ref to BimModel (§3.O, Phase 6) — stored as id until BimModel exists.
        bimSource: {type: SchemaTypes.ObjectId, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        approvedTotal: {type: SchemaTypes.Decimal128, required: false},
        contingencyPercent: {type: SchemaTypes.Number, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...budgetStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

BudgetSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `BUDGET-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(BudgetSchema);
auditPlugin(BudgetSchema);
softDeletePlugin(BudgetSchema);
applyBudgetIndexes(BudgetSchema);

const Budget = model<IBudget>("Budget", BudgetSchema, "budgets");
export default Budget;

normalizeSchemaPermissions(Budget);
addModelData(Budget, budgetViews);
validateSchemaDefAgainstMongoose(BudgetSchema, BudgetSchemaDef, "Budget", ["name", "status"]);
