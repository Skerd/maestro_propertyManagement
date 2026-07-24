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
import {SiteDiarySchemaDef, siteDiaryStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/siteDiary/siteDiary.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {siteDiaryViews} from "./siteDiary.views";
import {applySiteDiaryIndexes} from "./siteDiary.indexes";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface ISiteDiary extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const SiteDiarySchema = new Schema<ISiteDiary>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        diaryDate: {type: SchemaTypes.Date, required: true},
        weather: {type: SchemaTypes.String, required: false},
        workforceCount: {type: SchemaTypes.Number, required: false},
        plantSummary: {type: SchemaTypes.String, required: false},
        workSummary: {type: SchemaTypes.String, required: false},
        visitors: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...siteDiaryStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

SiteDiarySchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `DIARY-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(SiteDiarySchema);
auditPlugin(SiteDiarySchema);
softDeletePlugin(SiteDiarySchema);
applySiteDiaryIndexes(SiteDiarySchema);

const SiteDiary = model<ISiteDiary>("SiteDiary", SiteDiarySchema, "sitediaries");
export default SiteDiary;

normalizeSchemaPermissions(SiteDiary);
addModelData(SiteDiary, siteDiaryViews);
validateSchemaDefAgainstMongoose(SiteDiarySchema, SiteDiarySchemaDef, "SiteDiary", ["name", "status"]);
