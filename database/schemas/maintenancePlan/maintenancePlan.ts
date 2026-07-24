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
import {MaintenancePlanSchemaDef, maintenancePlanTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/maintenancePlan.schema-def";
import {AssetSimpleSnippet} from "../asset/asset.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {maintenancePlanViews} from "./maintenancePlan.views";
import {applyMaintenancePlanIndexes} from "./maintenancePlan.indexes";

export interface IMaintenancePlan extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    [key: string]: any;
}

const MaintenancePlanSchema = new Schema<IMaintenancePlan>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        asset: {type: SchemaTypes.ObjectId, ref: "Asset", required: false, refAllowlist: AssetSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        planType: {type: SchemaTypes.String, enum: [...maintenancePlanTypeValues], required: false, default: "preventive"},
        intervalDays: {type: SchemaTypes.Number, required: false},
        nextDueAt: {type: SchemaTypes.Date, required: false},
        responsibleParty: {type: SchemaTypes.String, required: false, trim: true},
        active: {type: SchemaTypes.Boolean, required: false, default: true},
        notes: {type: SchemaTypes.String, required: false},
    },
    {accessMode: "loose"},
);

MaintenancePlanSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `MPL-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(MaintenancePlanSchema);
auditPlugin(MaintenancePlanSchema);
softDeletePlugin(MaintenancePlanSchema);
applyMaintenancePlanIndexes(MaintenancePlanSchema);

const MaintenancePlan = model<IMaintenancePlan>("MaintenancePlan", MaintenancePlanSchema, "maintenanceplans");
export default MaintenancePlan;

normalizeSchemaPermissions(MaintenancePlan);
addModelData(MaintenancePlan, maintenancePlanViews);
validateSchemaDefAgainstMongoose(MaintenancePlanSchema, MaintenancePlanSchemaDef, "MaintenancePlan", ["name"]);
