import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUser} from "@coreModule/database/schemas/user/user";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {SnagSchemaDef, snagStatusValues, snagSeverityValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.schema-def";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {snagViews} from "./snag.views";
import {applySnagIndexes} from "./snag.indexes";

export interface ISnag extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    unit: IUnit;
    title: string;
    description?: string;
    location?: string;
    status?: string;
    severity?: string;
    reportedBy?: IUser;
    assignedTo?: IUser;
    dueDate?: Date;
    resolvedAt?: Date;
    photos: IMedia[];
    notes?: string;
}

const SnagSchema = new Schema<ISnag>(
    {
        name:        {type: SchemaTypes.String, required: true, trim: true},
        unit:        {type: SchemaTypes.ObjectId, ref: "Unit", required: true, refAllowlist: UnitSimpleSnippet},
        title:       {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: false},
        location:    {type: SchemaTypes.String, required: false, trim: true},
        status:      {
            type: SchemaTypes.String,
            enum: [...snagStatusValues],
            required: false,
            default: "open",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        severity:    {type: SchemaTypes.String, enum: [...snagSeverityValues], required: false, default: "medium"},
        reportedBy:  {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        assignedTo:  {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        dueDate:     {type: SchemaTypes.Date, required: false},
        resolvedAt:  {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        photos: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"}
);

SnagSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `SNAG-${date}-${suffix}`;
    }
    next();
});

SnagSchema.pre("save", function (next) {
    // auto-set resolvedAt when status transitions to resolved
    if (this.isModified("status") && (this as any).status === "resolved" && !(this as any).resolvedAt) {
        (this as any).resolvedAt = new Date();
    }
    next();
});

ownershipPlugin(SnagSchema);
auditPlugin(SnagSchema);
softDeletePlugin(SnagSchema);
applySnagIndexes(SnagSchema);

const Snag = model<ISnag>("Snag", SnagSchema, "snags");
export default Snag;

normalizeSchemaPermissions(Snag);

addModelData(Snag, snagViews);
validateSchemaDefAgainstMongoose(SnagSchema, SnagSchemaDef, "Snag", ["name", "status"]);
