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
import {SafetyIncidentSchemaDef, safetyIncidentStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/safetyIncident.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {safetyIncidentViews} from "./safetyIncident.views";
import {applySafetyIncidentIndexes} from "./safetyIncident.indexes";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";

export interface ISafetyIncident extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const SafetyIncidentSchema = new Schema<ISafetyIncident>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        severity: {type: SchemaTypes.String, enum: ["low","medium","high","critical"], required: true},
        location: {type: SchemaTypes.String, required: false},
        incidentDate: {type: SchemaTypes.Date, required: true},
        personsInvolved: {type: SchemaTypes.String, required: false},
        description: {type: SchemaTypes.String, required: true},
        correctiveActions: {type: SchemaTypes.String, required: false},
        reportedBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...safetyIncidentStatusValues],
            required: false,
            default: "reported",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

SafetyIncidentSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `HSE-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(SafetyIncidentSchema);
auditPlugin(SafetyIncidentSchema);
softDeletePlugin(SafetyIncidentSchema);
applySafetyIncidentIndexes(SafetyIncidentSchema);

const SafetyIncident = model<ISafetyIncident>("SafetyIncident", SafetyIncidentSchema, "safetyincidents");
export default SafetyIncident;

normalizeSchemaPermissions(SafetyIncident);
addModelData(SafetyIncident, safetyIncidentViews);
validateSchemaDefAgainstMongoose(SafetyIncidentSchema, SafetyIncidentSchemaDef, "SafetyIncident", ["name", "status"]);
