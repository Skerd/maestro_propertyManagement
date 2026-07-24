import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IProject} from "../project/project";
import {IEdifice} from "../edifice/edifice";
import {IMilestone} from "../milestone/milestone";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUser} from "@coreModule/database/schemas/user/user";
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
import {ScheduleTaskSchemaDef, scheduleTaskStatusValues, scheduleTaskDependencyTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/scheduleTask.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {MilestoneSimpleSnippet} from "../milestone/milestone.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {scheduleTaskViews} from "./scheduleTask.views";
import {applyScheduleTaskIndexes} from "./scheduleTask.indexes";

export interface IScheduleTask extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    edifice?: IEdifice;
    milestone?: IMilestone;
    title: string;
    description?: string;
    status?: string;
    assignee?: IUser;
    plannedStart?: Date;
    plannedEnd?: Date;
    actualStart?: Date;
    actualEnd?: Date;
    percentComplete?: number;
    notes?: string;
    media: IMedia[];
}

const ScheduleTaskSchema = new Schema<IScheduleTask>(
    {
        name:         {type: SchemaTypes.String, required: true, trim: true},
        project:      {type: SchemaTypes.ObjectId, ref: "Project",   required: true,  refAllowlist: ProjectSimpleSnippet},
        edifice:      {type: SchemaTypes.ObjectId, ref: "Edifice",   required: false, refAllowlist: EdificeSimpleSnippet},
        milestone:    {type: SchemaTypes.ObjectId, ref: "Milestone", required: false, refAllowlist: MilestoneSimpleSnippet},
        title:        {type: SchemaTypes.String, required: true, trim: true},
        description:  {type: SchemaTypes.String, required: false},
        status:       {
            type: SchemaTypes.String,
            enum: [...scheduleTaskStatusValues],
            required: false,
            default: "planned",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        assignee:     {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleBlankUserSnippet},
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
        percentComplete: {type: SchemaTypes.Number, required: false, min: 0, max: 100, default: 0},
        predecessors: {type: [{type: SchemaTypes.ObjectId, ref: "ScheduleTask"}], default: undefined},
        dependencyType: {type: SchemaTypes.String, enum: [...scheduleTaskDependencyTypeValues], required: false},
        lagDays: {type: SchemaTypes.Number, required: false},
        bkpCode: {type: SchemaTypes.String, required: false, trim: true},
        notes:        {type: SchemaTypes.String, required: false},
        media: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
    },
    {accessMode: "loose"}
);

ScheduleTaskSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `TASK-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ScheduleTaskSchema);
auditPlugin(ScheduleTaskSchema);
softDeletePlugin(ScheduleTaskSchema);
lifeCyclePlugin(ScheduleTaskSchema);
applyScheduleTaskIndexes(ScheduleTaskSchema);

const ScheduleTask = model<IScheduleTask>("ScheduleTask", ScheduleTaskSchema, "scheduletasks");
export default ScheduleTask;

normalizeSchemaPermissions(ScheduleTask);

addModelData(ScheduleTask, scheduleTaskViews);
validateSchemaDefAgainstMongoose(ScheduleTaskSchema, ScheduleTaskSchemaDef, "ScheduleTask", ["name", "status", "actualStart", "actualEnd"]);
