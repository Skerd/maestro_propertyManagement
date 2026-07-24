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
import {ApprovalWorkflowSchemaDef, approvalDocumentTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalWorkflow/approvalWorkflow.schema-def";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {approvalWorkflowViews} from "./approvalWorkflow.views";
import {applyApprovalWorkflowIndexes} from "./approvalWorkflow.indexes";

export interface IApprovalWorkflow extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    documentType: string;
    active?: boolean;
    [key: string]: any;
}

const ApprovalWorkflowSchema = new Schema<IApprovalWorkflow>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        documentType: {type: SchemaTypes.String, enum: [...approvalDocumentTypeValues], required: true},
        title: {type: SchemaTypes.String, required: true, trim: true},
        approverRole: {type: SchemaTypes.String, required: false, trim: true},
        thresholdAmount: {type: SchemaTypes.Decimal128, required: false},
        thresholdCurrency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        escalationRole: {type: SchemaTypes.String, required: false, trim: true},
        active: {type: SchemaTypes.Boolean, required: false, default: true},
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"},
);

ApprovalWorkflowSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `AWF-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ApprovalWorkflowSchema);
auditPlugin(ApprovalWorkflowSchema);
softDeletePlugin(ApprovalWorkflowSchema);
applyApprovalWorkflowIndexes(ApprovalWorkflowSchema);

const ApprovalWorkflow = model<IApprovalWorkflow>("ApprovalWorkflow", ApprovalWorkflowSchema, "approvalworkflows");
export default ApprovalWorkflow;

normalizeSchemaPermissions(ApprovalWorkflow);
addModelData(ApprovalWorkflow, approvalWorkflowViews);
// thresholdAmount is Decimal128 in mongoose, number in the SchemaDef — validator maps it.
validateSchemaDefAgainstMongoose(ApprovalWorkflowSchema, ApprovalWorkflowSchemaDef, "ApprovalWorkflow", ["name"]);
