import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IProject} from "@propertyManagement/database/schemas/project/project";
import {IEdifice} from "@propertyManagement/database/schemas/edifice/edifice";
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
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {ConstructionProgressSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.schema-def";
import {
    CONSTRUCTION_PHASE_VALUES,
    CONSTRUCTION_PROGRESS_LONG_TEXT_MAX,
    CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX,
    type ConstructionPhase,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.constants";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {constructionProgressViews} from "./constructionProgress.views";
import {applyConstructionProgressIndexes} from "./constructionProgress.indexes";

/**
 * A dated construction-progress report for a project (optionally one building): phase, % of works,
 * photos. Advancing reports notify the clients of the affected units (see notifyConstructionProgressClients).
 * Distinct from propertyDevelopment's ConstructionUpdate (different model / collection).
 */
export interface IConstructionProgress extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    edifice?: IEdifice;
    phase: ConstructionPhase;
    progressPercent: number;
    updateDate: string;
    title: string;
    description?: string;
    expectedCompletionDate?: string;
    photos: IMedia[];
    notifyClients?: boolean;
    clientsNotifiedAt?: Date;
    clientsNotifiedCount?: number;
}

const SYSTEM_WRITE = {self: {write: "no-permission"}, others: {write: "no-permission"}};

const ConstructionProgressSchema = new Schema<IConstructionProgress>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            maxlength: CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX,
            permissions: SYSTEM_WRITE,
            dynamicTableConfiguration: {visible: false},
        },
        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        phase: {type: SchemaTypes.String, required: true, enum: CONSTRUCTION_PHASE_VALUES},
        progressPercent: {type: SchemaTypes.Number, required: true, min: 0, max: 100, dynamicTableConfiguration: {cellType: COLUMN_TYPE.PERCENTAGE}},
        updateDate: {type: SchemaTypes.String, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        title: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX,
        },
        description: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: CONSTRUCTION_PROGRESS_LONG_TEXT_MAX,
            dynamicTableConfiguration: {visible: false},
        },
        expectedCompletionDate: {type: SchemaTypes.String, required: false, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        photos: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {visible: false},
        },
        notifyClients: {type: SchemaTypes.Boolean, required: false, default: true, dynamicTableConfiguration: {visible: false}},
        clientsNotifiedAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME, visible: false}},
        clientsNotifiedCount: {type: SchemaTypes.Number, required: false, permissions: SYSTEM_WRITE, dynamicTableConfiguration: {visible: false}},
    },
    {accessMode: "loose"}
);

ConstructionProgressSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `PROG-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ConstructionProgressSchema);
auditPlugin(ConstructionProgressSchema);
softDeletePlugin(ConstructionProgressSchema);
lifeCyclePlugin(ConstructionProgressSchema);
applyConstructionProgressIndexes(ConstructionProgressSchema);

const ConstructionProgress = model<IConstructionProgress>("ConstructionProgress", ConstructionProgressSchema, "constructionprogresses");
export default ConstructionProgress;

normalizeSchemaPermissions(ConstructionProgress);

addModelData(ConstructionProgress, constructionProgressViews);
validateSchemaDefAgainstMongoose(ConstructionProgressSchema, ConstructionProgressSchemaDef, "ConstructionProgress", [
    "name",
    "clientsNotifiedAt",
    "clientsNotifiedCount",
]);
