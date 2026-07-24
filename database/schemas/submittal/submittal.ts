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
import {SubmittalSchemaDef, submittalStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/submittal/submittal.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {submittalViews} from "./submittal.views";
import {applySubmittalIndexes} from "./submittal.indexes";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";

export interface ISubmittal extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const SubmittalSchema = new Schema<ISubmittal>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        specReference: {type: SchemaTypes.String, required: false},
        description: {type: SchemaTypes.String, required: false},
        submittedBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        reviewedBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        relatedDocument: {type: SchemaTypes.ObjectId, ref: "ProjectDocument", required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...submittalStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

SubmittalSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `SUB-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(SubmittalSchema);
auditPlugin(SubmittalSchema);
softDeletePlugin(SubmittalSchema);
applySubmittalIndexes(SubmittalSchema);

const Submittal = model<ISubmittal>("Submittal", SubmittalSchema, "submittals");
export default Submittal;

normalizeSchemaPermissions(Submittal);
addModelData(Submittal, submittalViews);
validateSchemaDefAgainstMongoose(SubmittalSchema, SubmittalSchemaDef, "Submittal", ["name", "status"]);
