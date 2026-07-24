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
import {PlanMarkupSchemaDef, planMarkupStatusValues, planMarkupMarkerTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/planMarkup.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {planMarkupViews} from "./planMarkup.views";
import {applyPlanMarkupIndexes} from "./planMarkup.indexes";

export interface IPlanMarkup extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const PlanMarkupSchema = new Schema<IPlanMarkup>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        planDocument: {type: SchemaTypes.ObjectId, ref: "ProjectDocument", required: true},
        project: {type: SchemaTypes.ObjectId, ref: "Project", required: false, refAllowlist: ProjectSimpleSnippet},
        page: {type: SchemaTypes.Number, required: false},
        layer: {type: SchemaTypes.String, required: false, trim: true},
        markerType: {type: SchemaTypes.String, enum: [...planMarkupMarkerTypeValues], required: true},
        geometryX: {type: SchemaTypes.Number, required: false},
        geometryY: {type: SchemaTypes.Number, required: false},
        geometryW: {type: SchemaTypes.Number, required: false},
        geometryH: {type: SchemaTypes.Number, required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: false},
        assignee: {type: SchemaTypes.ObjectId, ref: "User", required: false},
        linkedSnag: {type: SchemaTypes.ObjectId, ref: "Snag", required: false},
        linkedRfi: {type: SchemaTypes.ObjectId, ref: "Rfi", required: false},
        linkedScheduleTask: {type: SchemaTypes.ObjectId, ref: "ScheduleTask", required: false},
        createdOnSite: {type: SchemaTypes.Boolean, required: false, default: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: []},

        status: {
            type: SchemaTypes.String,
            enum: [...planMarkupStatusValues],
            required: false,
            default: "open",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

PlanMarkupSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `PM-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(PlanMarkupSchema);
auditPlugin(PlanMarkupSchema);
softDeletePlugin(PlanMarkupSchema);
applyPlanMarkupIndexes(PlanMarkupSchema);

const PlanMarkup = model<IPlanMarkup>("PlanMarkup", PlanMarkupSchema, "planmarkups");
export default PlanMarkup;

normalizeSchemaPermissions(PlanMarkup);
addModelData(PlanMarkup, planMarkupViews);
validateSchemaDefAgainstMongoose(PlanMarkupSchema, PlanMarkupSchemaDef, "PlanMarkup", ["name", "status"]);
