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
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {MilestoneSchemaDef, milestoneStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/milestone.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {MilestoneSimpleSnippet} from "./milestone.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {milestoneViews} from "./milestone.views";
import {applyMilestoneIndexes} from "./milestone.indexes";

export interface IMilestone extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    edifice?: IEdifice;
    title: string;
    description?: string;
    status?: string;
    plannedStart?: Date;
    plannedEnd?: Date;
    actualStart?: Date;
    actualEnd?: Date;
    weightPercent?: number;
    predecessors: IMilestone[];
    notes?: string;
    media: IMedia[];
}

const MilestoneSchema = new Schema<IMilestone>(
    {
        name:         {type: SchemaTypes.String, required: true, trim: true},
        project:      {type: SchemaTypes.ObjectId, ref: "Project", required: true,  refAllowlist: ProjectSimpleSnippet},
        edifice:      {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title:        {type: SchemaTypes.String, required: true, trim: true},
        description:  {type: SchemaTypes.String, required: false},
        status:       {
            type: SchemaTypes.String,
            enum: [...milestoneStatusValues],
            required: false,
            default: "planned",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        plannedStart: {type: SchemaTypes.Date, required: false},
        plannedEnd:   {type: SchemaTypes.Date, required: false},
        actualStart:  {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        actualEnd:    {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        weightPercent: {type: SchemaTypes.Number, required: false, min: 0, max: 100},
        predecessors: {
            type: [{type: SchemaTypes.ObjectId, ref: "Milestone"}],
            default: [],
            refAllowlist: MilestoneSimpleSnippet,
        },
        notes:        {type: SchemaTypes.String, required: false},
        media: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
    },
    {accessMode: "loose"}
);

MilestoneSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `MILESTONE-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(MilestoneSchema);
auditPlugin(MilestoneSchema);
softDeletePlugin(MilestoneSchema);
lifeCyclePlugin(MilestoneSchema);
applyMilestoneIndexes(MilestoneSchema);

const Milestone = model<IMilestone>("Milestone", MilestoneSchema, "milestones");
export default Milestone;

normalizeSchemaPermissions(Milestone);

addModelData(Milestone, milestoneViews);
validateSchemaDefAgainstMongoose(MilestoneSchema, MilestoneSchemaDef, "Milestone", ["name", "status", "actualStart", "actualEnd"]);
