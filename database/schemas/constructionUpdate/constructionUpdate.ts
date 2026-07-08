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
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {ConstructionUpdateSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/constructionUpdate.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {constructionUpdateViews} from "./constructionUpdate.views";
import {applyConstructionUpdateIndexes} from "./constructionUpdate.indexes";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IConstructionUpdate extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    edifice?: IEdifice;
    title: string;
    description?: string;
    progressPercent: number;
    updateDate: Date;
    photos: IMedia[];
}

const ConstructionUpdateSchema = new Schema<IConstructionUpdate>(
    {
        name:        {type: SchemaTypes.String, required: true, trim: true},
        project:     {type: SchemaTypes.ObjectId, ref: "Project",  required: true, refAllowlist: ProjectSimpleSnippet},
        edifice:     {type: SchemaTypes.ObjectId, ref: "Edifice",  required: false, refAllowlist: EdificeSimpleSnippet},
        title:       {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: false},
        progressPercent: {type: SchemaTypes.Number, required: true, min: 0, max: 100},
        updateDate:  {type: SchemaTypes.Date,   required: true},
        photos: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
    },
    {accessMode: "loose"}
);

ConstructionUpdateSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `UPDATE-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ConstructionUpdateSchema);
auditPlugin(ConstructionUpdateSchema);
softDeletePlugin(ConstructionUpdateSchema);
lifeCyclePlugin(ConstructionUpdateSchema);
applyConstructionUpdateIndexes(ConstructionUpdateSchema);

const ConstructionUpdate = model<IConstructionUpdate>("ConstructionUpdate", ConstructionUpdateSchema, "constructionupdates");
export default ConstructionUpdate;

normalizeSchemaPermissions(ConstructionUpdate);

addModelData(ConstructionUpdate, constructionUpdateViews);
validateSchemaDefAgainstMongoose(ConstructionUpdateSchema, ConstructionUpdateSchemaDef, "ConstructionUpdate", ["name"]);
