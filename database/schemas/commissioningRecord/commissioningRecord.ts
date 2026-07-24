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
import {CommissioningRecordSchemaDef, commissioningRecordStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/commissioningRecord/commissioningRecord.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {commissioningRecordViews} from "./commissioningRecord.views";
import {applyCommissioningRecordIndexes} from "./commissioningRecord.indexes";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";

export interface ICommissioningRecord extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const CommissioningRecordSchema = new Schema<ICommissioningRecord>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        unit: {type: SchemaTypes.ObjectId, ref: "Unit", required: false, refAllowlist: UnitSimpleSnippet},
        handoverPackage: {type: SchemaTypes.ObjectId, ref: "HandoverPackage", required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        systemName: {type: SchemaTypes.String, required: false},
        testDate: {type: SchemaTypes.Date, required: false},
        resultNotes: {type: SchemaTypes.String, required: false},
        inspectedBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...commissioningRecordStatusValues],
            required: false,
            default: "pending",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

CommissioningRecordSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `COMM-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(CommissioningRecordSchema);
auditPlugin(CommissioningRecordSchema);
softDeletePlugin(CommissioningRecordSchema);
applyCommissioningRecordIndexes(CommissioningRecordSchema);

const CommissioningRecord = model<ICommissioningRecord>("CommissioningRecord", CommissioningRecordSchema, "commissioningrecords");
export default CommissioningRecord;

normalizeSchemaPermissions(CommissioningRecord);
addModelData(CommissioningRecord, commissioningRecordViews);
validateSchemaDefAgainstMongoose(CommissioningRecordSchema, CommissioningRecordSchemaDef, "CommissioningRecord", ["name", "status"]);
