import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IProject} from "../project/project";
import {IEdifice} from "../edifice/edifice";
import {IFloor} from "../floor/floor";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    ProjectDocumentSchemaDef,
    projectDocumentStatusValues,
    projectDocumentDisciplineValues,
    projectDocumentTypeValues,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/projectDocument.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {FloorSimpleSnippet} from "../floor/floor.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {ProjectDocumentSimpleSnippet} from "./projectDocument.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {projectDocumentViews} from "./projectDocument.views";
import {applyProjectDocumentIndexes} from "./projectDocument.indexes";

export interface IProjectDocument extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    project: IProject;
    edifice?: IEdifice;
    floor?: IFloor;
    unit?: IUnit;
    title: string;
    documentNumber?: string;
    discipline: string;
    documentType: string;
    revision?: string;
    revisionDate?: Date;
    description?: string;
    notes?: string;
    media: IMedia[];
    supersedes?: IProjectDocument;
    designStage?: any;
    isRequiredDeliverable?: boolean;
    status?: string;
    isAsBuilt?: boolean;
}

const ProjectDocumentSchema = new Schema<IProjectDocument>(
    {
        name:           {type: SchemaTypes.String, required: true, trim: true},
        project:        {type: SchemaTypes.ObjectId, ref: "Project", required: true,  refAllowlist: ProjectSimpleSnippet},
        edifice:        {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        floor:          {type: SchemaTypes.ObjectId, ref: "Floor",   required: false, refAllowlist: FloorSimpleSnippet},
        unit:           {type: SchemaTypes.ObjectId, ref: "Unit",    required: false, refAllowlist: UnitSimpleSnippet},
        title:          {type: SchemaTypes.String, required: true, trim: true},
        documentNumber: {type: SchemaTypes.String, required: false, trim: true},
        discipline:     {type: SchemaTypes.String, enum: [...projectDocumentDisciplineValues], required: true},
        documentType:   {type: SchemaTypes.String, enum: [...projectDocumentTypeValues], required: true},
        revision:       {type: SchemaTypes.String, required: false, trim: true, default: "A"},
        revisionDate:   {type: SchemaTypes.Date, required: false},
        description:    {type: SchemaTypes.String, required: false},
        notes:          {type: SchemaTypes.String, required: false},
        media: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
        supersedes: {
            type: SchemaTypes.ObjectId,
            ref: "ProjectDocument",
            required: false,
            refAllowlist: ProjectDocumentSimpleSnippet,
        },
        designStage: {
            type: SchemaTypes.ObjectId,
            ref: "DesignStage",
            required: false,
        },
        isRequiredDeliverable: {
            type: SchemaTypes.Boolean,
            required: false,
            default: false,
        },
        status: {
            type: SchemaTypes.String,
            enum: [...projectDocumentStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        isAsBuilt: {
            type: SchemaTypes.Boolean,
            required: false,
            default: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"}
);

ProjectDocumentSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `DOC-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ProjectDocumentSchema);
auditPlugin(ProjectDocumentSchema);
softDeletePlugin(ProjectDocumentSchema);
applyProjectDocumentIndexes(ProjectDocumentSchema);

const ProjectDocument = model<IProjectDocument>("ProjectDocument", ProjectDocumentSchema, "projectdocuments");
export default ProjectDocument;

normalizeSchemaPermissions(ProjectDocument);

addModelData(ProjectDocument, projectDocumentViews);
validateSchemaDefAgainstMongoose(ProjectDocumentSchema, ProjectDocumentSchemaDef, "ProjectDocument", ["name", "status", "isAsBuilt"]);
