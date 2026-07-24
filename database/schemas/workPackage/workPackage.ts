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
import {WorkPackageSchemaDef, workPackageStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/workPackage/workPackage.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {workPackageViews} from "./workPackage.views";
import {applyWorkPackageIndexes} from "./workPackage.indexes";

export interface IWorkPackage extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const WorkPackageSchema = new Schema<IWorkPackage>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: false},
        title: {type: SchemaTypes.String, required: true, trim: true},
        trade: {type: SchemaTypes.String, required: false},
        description: {type: SchemaTypes.String, required: false},
        plannedStart: {type: SchemaTypes.Date, required: false},
        plannedEnd: {type: SchemaTypes.Date, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...workPackageStatusValues],
            required: false,
            default: "planned",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

WorkPackageSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `WP-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(WorkPackageSchema);
auditPlugin(WorkPackageSchema);
softDeletePlugin(WorkPackageSchema);
applyWorkPackageIndexes(WorkPackageSchema);

const WorkPackage = model<IWorkPackage>("WorkPackage", WorkPackageSchema, "workpackages");
export default WorkPackage;

normalizeSchemaPermissions(WorkPackage);
addModelData(WorkPackage, workPackageViews);
validateSchemaDefAgainstMongoose(WorkPackageSchema, WorkPackageSchemaDef, "WorkPackage", ["name", "status"]);
