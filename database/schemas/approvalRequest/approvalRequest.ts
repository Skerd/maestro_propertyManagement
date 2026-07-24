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
import {ApprovalRequestSchemaDef, approvalRequestStatusValues, approvalRequestStageValues, approvalDocumentTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/approvalRequest.schema-def";
import {ApprovalWorkflowSimpleSnippet} from "../approvalWorkflow/approvalWorkflow.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {approvalRequestViews} from "./approvalRequest.views";
import {applyApprovalRequestIndexes} from "./approvalRequest.indexes";

const decisionValues = ["pending", "visaed", "approved", "rejected"] as const;

export interface IApprovalRequest extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    documentType: string;
    status?: string;
    currentStage?: string;
    [key: string]: any;
}

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        workflow: {type: SchemaTypes.ObjectId, ref: "ApprovalWorkflow", required: false, refAllowlist: ApprovalWorkflowSimpleSnippet},
        documentType: {type: SchemaTypes.String, enum: [...approvalDocumentTypeValues], required: true},
        targetType: {type: SchemaTypes.String, required: true, trim: true},
        targetId: {type: SchemaTypes.ObjectId, required: true},
        amount: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        notes: {type: SchemaTypes.String, required: false},

        currentStage: {
            type: SchemaTypes.String,
            enum: [...approvalRequestStageValues],
            required: false,
            default: "primary",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        primaryDecision: {
            type: SchemaTypes.String,
            enum: [...decisionValues],
            required: false,
            default: "pending",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        escalationDecision: {
            type: SchemaTypes.String,
            enum: [...decisionValues],
            required: false,
            default: "pending",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        status: {
            type: SchemaTypes.String,
            enum: [...approvalRequestStatusValues],
            required: false,
            default: "pending",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

ApprovalRequestSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `APR-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ApprovalRequestSchema);
auditPlugin(ApprovalRequestSchema);
softDeletePlugin(ApprovalRequestSchema);
applyApprovalRequestIndexes(ApprovalRequestSchema);

const ApprovalRequest = model<IApprovalRequest>("ApprovalRequest", ApprovalRequestSchema, "approvalrequests");
export default ApprovalRequest;

normalizeSchemaPermissions(ApprovalRequest);
addModelData(ApprovalRequest, approvalRequestViews);
validateSchemaDefAgainstMongoose(ApprovalRequestSchema, ApprovalRequestSchemaDef, "ApprovalRequest", ["name", "status", "currentStage", "primaryDecision", "escalationDecision"]);
