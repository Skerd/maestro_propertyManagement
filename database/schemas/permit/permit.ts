import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IProject} from "../project/project";
import {IEdifice} from "../edifice/edifice";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields,
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {PermitSchemaDef, permitStatusValues, permitTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/permit.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {permitViews} from "./permit.views";
import {applyPermitIndexes} from "./permit.indexes";

export interface IPermit extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    edifice?: IEdifice;
    title: string;
    permitType: string;
    authority?: string;
    referenceNumber?: string;
    description?: string;
    notes?: string;
    status?: string;
    submittedAt?: Date;
    approvedAt?: Date;
    expiresAt?: Date;
    renewedAt?: Date;
    expiryReminderSentAt30d?: Date;
    expiryReminderSentAt7d?: Date;
    expiryReminderSentAt3d?: Date;
    expiryReminderSentAt0d?: Date;
    media: IMedia[];
}

const noWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}} as const;
const systemOnly = {self: {read: "no-permission", write: "no-permission"}, others: {read: "no-permission", write: "no-permission"}} as const;

const PermitSchema = new Schema<IPermit>(
    {
        name:            {type: SchemaTypes.String, required: true, trim: true},
        project:         {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice:         {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title:           {type: SchemaTypes.String, required: true, trim: true},
        permitType:      {type: SchemaTypes.String, enum: [...permitTypeValues], required: true},
        authority:       {type: SchemaTypes.String, required: false, trim: true},
        referenceNumber: {type: SchemaTypes.String, required: false, trim: true},
        description:     {type: SchemaTypes.String, required: false},
        notes:           {type: SchemaTypes.String, required: false},
        status: {
            type: SchemaTypes.String,
            enum: [...permitStatusValues],
            required: false,
            default: "draft",
            permissions: noWritePermission,
        },
        submittedAt: {type: SchemaTypes.Date, required: false, permissions: noWritePermission},
        approvedAt:  {type: SchemaTypes.Date, required: false, permissions: noWritePermission},
        expiresAt:   {type: SchemaTypes.Date, required: false, permissions: noWritePermission},
        renewedAt:   {type: SchemaTypes.Date, required: false, permissions: noWritePermission},
        expiryReminderSentAt30d: {type: SchemaTypes.Date, required: false, permissions: systemOnly},
        expiryReminderSentAt7d:  {type: SchemaTypes.Date, required: false, permissions: systemOnly},
        expiryReminderSentAt3d:  {type: SchemaTypes.Date, required: false, permissions: systemOnly},
        expiryReminderSentAt0d:  {type: SchemaTypes.Date, required: false, permissions: systemOnly},
        media: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
    },
    {accessMode: "loose"}
);

PermitSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `PERMIT-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(PermitSchema);
auditPlugin(PermitSchema);
softDeletePlugin(PermitSchema);
lifeCyclePlugin(PermitSchema);
applyPermitIndexes(PermitSchema);

const Permit = model<IPermit>("Permit", PermitSchema, "permits");
export default Permit;

normalizeSchemaPermissions(Permit);

addModelData(Permit, permitViews);
validateSchemaDefAgainstMongoose(PermitSchema, PermitSchemaDef, "Permit", [
    "name",
    "status",
    "renewedAt",
    "expiryReminderSentAt30d",
    "expiryReminderSentAt7d",
    "expiryReminderSentAt3d",
    "expiryReminderSentAt0d",
]);
