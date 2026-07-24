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
import {RfiSchemaDef, rfiStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/rfi.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {rfiViews} from "./rfi.views";
import {applyRfiIndexes} from "./rfi.indexes";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";

export interface IRfi extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const RfiSchema = new Schema<IRfi>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        question: {type: SchemaTypes.String, required: true},
        answer: {type: SchemaTypes.String, required: false},
        askedBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        answeredBy: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
        dueDate: {type: SchemaTypes.Date, required: false},
        relatedDocument: {type: SchemaTypes.ObjectId, ref: "ProjectDocument", required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...rfiStatusValues],
            required: false,
            default: "open",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

RfiSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `RFI-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(RfiSchema);
auditPlugin(RfiSchema);
softDeletePlugin(RfiSchema);
applyRfiIndexes(RfiSchema);

const Rfi = model<IRfi>("Rfi", RfiSchema, "rfis");
export default Rfi;

normalizeSchemaPermissions(Rfi);
addModelData(Rfi, rfiViews);
validateSchemaDefAgainstMongoose(RfiSchema, RfiSchemaDef, "Rfi", ["name", "status"]);
